# To run:
#    1. Run Node Server
#    2. Plug in and run Arduino
#    3. Run the arduino-reader.py




import requests 
import threading
import time
import csv
import matplotlib.pyplot as plt


sensor_data_csv = open("sensor_data.csv", "w")
time_data_csv = open("time_data.csv", "w")





data = 0
record = False
sensor_data = []
time_data = []
startTime = 0


def send_req():
	global record
	global time_data
	global startTime
	URL = "http://127.0.0.1:3000"
	while(True):
		while(record):
			# GET ARDUINO DATA
			r = requests.get(url = URL)
			global data
			data = r.json()['value']
			sensor_data.append(data)
			print(data)
			time_data.append(time.time() - startTime)


T = threading.Thread(target=send_req)
T.setDaemon(True)
T.start()


def main():
	global record
	global startTime
	while(True):
		user_input = input("Record (r): ")
		if user_input == 'r':

			startTime = time.time()
			record = True
			while(True):
				user_input = input("Stop Recording (x): ")
				if(user_input == 'x'):
					record = False

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


main()
plot()