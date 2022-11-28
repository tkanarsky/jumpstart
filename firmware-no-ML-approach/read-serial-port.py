import serial.tools.list_ports
import threading
import time
import csv
import matplotlib.pyplot as plt

ports = serial.tools.list_ports.comports()
serialInst = serial.Serial()

sensor_data_csv = open("sensor_data.csv", "w")
time_data_csv = open("time_data.csv", "w")

sensor_data = []
time_data = []
startTime = 0

def setup():
    portsList = []

    for onePort in ports:
        portsList.append(str(onePort))
        print(str(onePort))

    val = 3

    for x in range(0,len(portsList)):
        if portsList[x].startswith("COM" + str(val)):
            portVar = "COM" + str(val)
            print(portVar)

    serialInst.baudrate = 9600
    serialInst.port = portVar
    serialInst.open()


def read_serial_port():
    global time_data
    global sensor_data
    while True:
        if serialInst.in_waiting:
            packet = serialInst.readline()
            sensor_data.append(packet.decode('utf').rstrip('\n'))
            time_data.append(time.time() - startTime)


def main():
    global startTime
    while(True):
        user_input = input("Record (r): ")
        if user_input == 'r':

            startTime = time.time()
            T = threading.Thread(target=read_serial_port)
            T.setDaemon(True)
            T.start()
            while(True):
                user_input = input("Stop Recording (x): ")
                if(user_input == 'x'):
                    print(time_data)
                    print(sensor_data)
                    writer = csv.writer(sensor_data_csv)
                    writer.writerow(sensor_data)
                    sensor_data_csv.close()

                    writer = csv.writer(time_data_csv)
                    writer.writerow(time_data)
                    time_data_csv.close()

                    return


def plot():
    time_data = []
    sensor_data = []


    with open('time_data.csv', 'r') as csvfile:
        lines = csv.reader(csvfile, delimiter=',')
        for row in lines:
            for i in row:
                time_data.append(float(i))


    with open('sensor_data.csv', 'r') as csvfile:
        lines = csv.reader(csvfile, delimiter=',')
        for row in lines:
            for i in row:
                sensor_data.append(float(i))



    plt.plot(time_data, sensor_data)
    plt.show()


setup()
main()
plot()