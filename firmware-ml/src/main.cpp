#include <Arduino.h>
#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <cstdint>
#include "jumping_jack_detector.h"

#define BUTTON 12
#define SAMPLES_PER_CHUNK 20
#define OVERLAP 5

float rx0, ry0, rz0;

Eloquent::ML::Port::XGBClassifier xgb;

BLEService jjDetectorService("7b048f32-b31d-4d94-ba3a-153d27ff6905");
BLEUnsignedIntCharacteristic jjDetectorChar("7b048f32-b31d-4d94-ba3a-153d27ff6906", BLERead | BLENotify);
void setup()
{
    asm(".global _printf_float");
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.begin(115200);
    while (!IMU.begin())
    {
        delay(100);
    }
    while (!BLE.begin())
    {
        delay(100);
    }
    BLE.setLocalName("JumpStart Controller");
    BLE.setAdvertisedService(jjDetectorService);
    jjDetectorService.addCharacteristic(jjDetectorChar);
    BLE.addService(jjDetectorService);
    BLE.advertise();
    pinMode(BUTTON, INPUT);
    float rx, ry, rz;
    for (int i = 0; i < 100; i++)
    {
        IMU.readGyroscope(rx, ry, rz);
        rx0 += rx;
        ry0 += ry;
        rz0 += rz;
        delay(10);
    }
    rx0 /= 100;
    ry0 /= 100;
    rz0 /= 100;
}

// Shifted sliding window buffer implementation
// 20 samples per chunk, 5 samples overlap
// We need five buffers each fitting 20 samples
// to be able to 'dispatch' an inference every 5 samples
// without clobbering the previous buffer

//                              SAMPLES_PER_OVERLAP
//
//                                  ┌────────┐
//                                  │        │
//
// ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
// │        │ │        │ │        │ │        │
// │        │ │        │ │        │ │        │
// │        │ │        │ │        │ │        │
// │        │ │        │ │        │ │        │
// └────────┘ └────────┘ └────────┘ └────────┘
//
//            ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
//            │        │ │        │ │        │ │        │
//            │        │ │        │ │        │ │        │
//            │        │ │        │ │        │ │        │
//            │        │ │        │ │        │ │        │
//            └────────┘ └────────┘ └────────┘ └────────┘
//
//                       ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
//                       │        │ │        │ │        │ │        │
//                       │        │ │        │ │        │ │        │
//                       │        │ │        │ │        │ │        │
//                       │        │ │        │ │        │ │        │
//                       └────────┘ └────────┘ └────────┘ └────────┘
//
//                                  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
//                                  │        │ │        │ │        │ │        │
//                                  │        │ │        │ │        │ │        │
//                                  │        │ │        │ │        │ │        │
//                                  │        │ │        │ │        │ │        │
//                                  └────────┘ └────────┘ └────────┘ └────────┘
//
//                                             ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
//                                             │        │ │        │ │        │ │        │
//                                             │        │ │        │ │        │ │        │
//                                             │        │ │        │ │        │ │        │
//                                             │        │ │        │ │        │ │        │
//                                             └────────┘ └────────┘ └────────┘ └────────┘
//
//                                             │                                         │
//                                             └─────────────────────────────────────────┘
//
//                                                           SAMPLES_PER_CHUNK

#define SAMPLES_PER_CHUNK 20
#define SAMPLES_PER_OVERLAP 1
#define OVERLAPS_PER_CHUNK (SAMPLES_PER_CHUNK / SAMPLES_PER_OVERLAP)
#define NUM_BUFFERS (OVERLAPS_PER_CHUNK + 1)

float buf[NUM_BUFFERS][SAMPLES_PER_CHUNK][6];

// Update buffers with new data.
// global_sample_idx is a monotonically increasing counter
// Return buffer to dispatch, or null if a buffer is not ready yet
float *write_sample_to_buffer(uint32_t global_sample_idx, float ax, float ay, float az, float rx, float ry, float rz)
{
    uint32_t global_overlap_idx = global_sample_idx / SAMPLES_PER_OVERLAP;
    uint8_t local_sample_idx = global_sample_idx % SAMPLES_PER_OVERLAP;
    //   Serial.print("local_sample_idx: ");
    //   Serial.println(local_sample_idx);
    uint8_t start_buffer_idx = global_overlap_idx % NUM_BUFFERS;
    uint8_t vertical_capacity =
        min((unsigned)OVERLAPS_PER_CHUNK, global_overlap_idx + 1);
    for (uint8_t i = 0; i < vertical_capacity; i++)
    {
        int8_t buffer_idx = (start_buffer_idx - i + NUM_BUFFERS) % NUM_BUFFERS;
        int8_t overlap_idx_for_buffer = (start_buffer_idx - buffer_idx < 0) ? (start_buffer_idx - buffer_idx + NUM_BUFFERS) % OVERLAPS_PER_CHUNK : (start_buffer_idx - buffer_idx) % OVERLAPS_PER_CHUNK;
        // Serial.print("overlap_idx_for_buffer: ");
        // Serial.println(overlap_idx_for_buffer);
        overlap_idx_for_buffer *= SAMPLES_PER_OVERLAP;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][0] = ax;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][1] = ay;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][2] = az;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][3] = rx;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][4] = ry;
        buf[buffer_idx][overlap_idx_for_buffer + local_sample_idx][5] = rz;
    };

    if (global_sample_idx > 0 && (global_sample_idx % SAMPLES_PER_OVERLAP) == SAMPLES_PER_OVERLAP - 1)
    {
        uint8_t ready_buffer_idx = (start_buffer_idx - (vertical_capacity - 1) + NUM_BUFFERS) % NUM_BUFFERS;
        return &buf[ready_buffer_idx][0][0];
    }
    else
    {
        return nullptr;
    }
}

void print_buffers()
{
    for (uint8_t i = 0; i < NUM_BUFFERS; i++)
    {
        for (uint8_t j = 0; j < i; j++)
        {
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
        }
        for (uint8_t j = 0; j < SAMPLES_PER_CHUNK; j++)
        {
            Serial.print(buf[i][j][0]);
            Serial.print(" ");
        }
        Serial.println();
    }
}

// Perform low-pass filter on predictions 
// Use exponential moving average; alpha is the weight of the new value.

#define LPF_ALPHA 0.2

// Drive state machine using filtered prediction values.
// State machine has two values -- DETECTING and NOT_DETECTING.
// Machine starts off in NOT_DETECTING state.
// Define two thresholds -- DETECTING_THRESHOLD and NOT_DETECTING_THRESHOLD.
// If we are in NOT_DETECTING state and prediction is above DETECTING_THRESHOLD, transition to DETECTING state.
// If we are in DETECTING state and prediction is below NOT_DETECTING_THRESHOLD, transition to NOT_DETECTING state and increment jumping jack counter
// DETECTING_THRESHOLD should be greater than NOT_DETECTING_THRESHOLD to add a bit of hysteresis.

enum State
{
    NOT_DETECTING,
    DETECTING
};

#define DETECTING_THRESHOLD 0.8
#define NOT_DETECTING_THRESHOLD 0.5

void loop()
{
    BLEDevice central = BLE.central();
    static float ax, ay, az, rx, ry, rz;
    uint32_t global_sample_idx = 0;
    uint32_t jj_count = 0;
    float prediction_avg = 0;   
    State state = NOT_DETECTING;
    bool still_connected = central.connected();
    while (still_connected)
    {
        digitalWrite(LED_BUILTIN, HIGH);
        if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable())
        {
            IMU.readAcceleration(ax, ay, az);
            IMU.readGyroscope(rx, ry, rz);
            // Apply calibration
            rx -= rx0;
            ry -= ry0;
            rz -= rz0;
            float *buf = write_sample_to_buffer(global_sample_idx, ax, ay, az, rx, ry, rz);
            global_sample_idx++;
            if (buf != nullptr)
            {
                still_connected = central.connected();
                if (!central.connected())
                {
                    break;
                }
                uint8_t label = xgb.predict(buf);
                prediction_avg = LPF_ALPHA * label + (1 - LPF_ALPHA) * prediction_avg;
                // Serial.print("Prediction_avg: ");
                // Serial.println(prediction_avg);
                if (state == NOT_DETECTING && prediction_avg > DETECTING_THRESHOLD)
                {
                    state = DETECTING;
                    // Serial.println("Transitioning to DETECTING state");
                }
                else if (state == DETECTING && prediction_avg < NOT_DETECTING_THRESHOLD)
                {
                    // Serial.println("Transitioning to NOT_DETECTING state");
                    state = NOT_DETECTING;
                    jj_count++;
                    jjDetectorChar.setValue(jj_count);
                    // Serial.print("New jj count: ");
                    // Serial.println(jj_count);
                }
                // Serial.println("prediction: " + String(label));
            }
        }
        delay(50);
    }
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}