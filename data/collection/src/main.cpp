#include <Arduino.h>
#include <LSM6DS3.h>

#define BUTTON 12

float rx0, ry0, rz0;

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

void loop()
{
    static float ax, ay, az, rx, ry, rz;
    static bool pressed = 0;
    static char buf[100];
    if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable())
    {
        IMU.readAcceleration(ax, ay, az);
        IMU.readGyroscope(rx, ry, rz);
        pressed = digitalRead(BUTTON);
        rx -= rx0; ry -= ry0; rz -= rz0;
        snprintf(buf, 100, "%f,%f,%f,%f,%f,%f,%u", ax, ay, az, rx, ry, rz, pressed);
        Serial.println(buf);
    }
    delay(50);
}