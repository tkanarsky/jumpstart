#include <Arduino.h>
#include <LSM6DS3.h>
#include <cstdint>
#include "jumping_jack_detector.h"

#define BUTTON 12
#define SAMPLES_PER_CHUNK 20
#define OVERLAP 5

float rx0, ry0, rz0;

Eloquent::ML::Port::RandomForest forest;

void setup()
{
    asm(".global _printf_float");
    Serial.begin(115200);
    while (!IMU.begin())
    {
        delay(100);
    }
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
float* write_sample_to_buffer(uint32_t global_sample_idx, float ax, float ay, float az, float rx, float ry, float rz) {
  uint32_t global_overlap_idx = global_sample_idx / SAMPLES_PER_OVERLAP;
  uint8_t local_sample_idx = global_sample_idx % SAMPLES_PER_OVERLAP;
//   Serial.print("local_sample_idx: ");
//   Serial.println(local_sample_idx);
  uint8_t start_buffer_idx = global_overlap_idx % NUM_BUFFERS;
  uint8_t vertical_capacity =
      min((unsigned)OVERLAPS_PER_CHUNK, global_overlap_idx + 1);
  for (uint8_t i = 0; i < vertical_capacity; i++) {
    int8_t buffer_idx = (start_buffer_idx - i + NUM_BUFFERS) % NUM_BUFFERS;
    int8_t overlap_idx_for_buffer = (start_buffer_idx - buffer_idx < 0) ? 
        (start_buffer_idx - buffer_idx + NUM_BUFFERS) % OVERLAPS_PER_CHUNK : 
        (start_buffer_idx - buffer_idx) % OVERLAPS_PER_CHUNK;
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

  if (global_sample_idx > 0 && (global_sample_idx % SAMPLES_PER_OVERLAP) == SAMPLES_PER_OVERLAP - 1) {
    uint8_t ready_buffer_idx = (start_buffer_idx - (vertical_capacity - 1) + NUM_BUFFERS) % NUM_BUFFERS;
    return &buf[ready_buffer_idx][0][0];
  } else {
    return nullptr;
  }
}

void print_buffers() {
    for(uint8_t i = 0; i < NUM_BUFFERS; i++) {
        for (uint8_t j = 0; j < i; j++) {
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
            Serial.print("     ");
        }
        for (uint8_t j = 0; j < SAMPLES_PER_CHUNK; j++) {
            Serial.print(buf[i][j][0]);
            Serial.print(" ");
        }
        Serial.println();
    }
}


void loop()
{
    static float ax, ay, az, rx, ry, rz;
    static bool pressed = 0;
    static char text_buf[100];
    static uint32_t global_sample_idx = 0;
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable())
    {
        IMU.readAcceleration(ax, ay, az);
        IMU.readGyroscope(rx, ry, rz);
        pressed = digitalRead(BUTTON);
        rx -= rx0; ry -= ry0; rz -= rz0;
        float* buf = write_sample_to_buffer(global_sample_idx, ax, ay, az, rx, ry, rz);
        global_sample_idx++;
        // print_buffers();
        if (buf != nullptr) {
            uint8_t label = forest.predict(buf);
            Serial.println("prediction: " + String(label));
        }
    }
    delay(50);
}