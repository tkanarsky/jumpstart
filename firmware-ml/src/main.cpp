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

float buffer[6 * SAMPLES_PER_CHUNK];
int bufferIndex = 0;

void loop()
{
    static float ax, ay, az, rx, ry, rz;
    static bool pressed = 0;
    static char text_buf[100];
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable())
    {
        IMU.readAcceleration(ax, ay, az);
        IMU.readGyroscope(rx, ry, rz);
        pressed = digitalRead(BUTTON);
        rx -= rx0; ry -= ry0; rz -= rz0;
        if (bufferIndex == 6 * SAMPLES_PER_CHUNK) {
            bufferIndex = 0;
            uint8_t label = forest.predict(buffer);
            Serial.println("prediction: " + String(label));
        } else {
            buffer[bufferIndex] = ax;
            buffer[bufferIndex+1] = ay;
            buffer[bufferIndex+2] = az;
            buffer[bufferIndex+3] = rx;
            buffer[bufferIndex+4] = ry;
            buffer[bufferIndex+5] = rz;
            bufferIndex += 6;
        }
    }
    delay(50);
}