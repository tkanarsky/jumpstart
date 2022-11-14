/**
 * nvm use 18
 * npm install express
 * npm install cors
 * npm install @abandonware/noble
 */
const accCanvas = document.getElementById("Acceleration");
const endpoint = "http://127.0.0.1:3000";
const PLOT_DATA_LENGTH = 40;
const TIME_INTERVAL = 400;

let accData = {
  ax: [0],
  ay: [0],
  az: [0],
};

const datasetTemplate = {
  ax: {
    label: "ax",
    backgroundColor: "rgb(47 119 185)",
    borderColor: "rgb(47 119 185)",
  },
  ay: {
    label: "ay",
    backgroundColor: "rgb(255, 99, 132)",
    borderColor: "rgb(255, 99, 132)",
  },
  az: {
    label: "az",
    backgroundColor: "rgb(109 206 67)",
    borderColor: "rgb(109 206 67)",
  },
};

const getLatestAccelerationData = async () => {
  // Get the latest ax, ay, az value from backend server
  const resp = await fetchData(endpoint, { method: "GET" });
  let val = {};
  await resp.json().then((data) => {
    // console.log(data.sensorValue);
    val = data.sensorValue;
  });
  // console.log(val, "#########");
  return val;
};

const updateAccelerationData = async () => {
  const { ax, ay, az } = await getLatestAccelerationData();
  console.log("Latest value: ", ax, ay, az, "!!!!!!!");
  if (accData.ax.length < PLOT_DATA_LENGTH) {
    accData = { ax: [...accData.ax, ax], ay: [...accData.ay, ay], az: [...accData.az, az] };
  } else {
    // accData.ax = accData.ax.splice(accData.ax.length - 1, 1, ax); // Replace the last element with ax
    accData.ax.shift();
    accData.ay.shift();
    accData.az.shift();
    accData.ax.push(ax);
    accData.ay.push(ay);
    accData.az[accData.az.length] = az; // Same as push()
  }
};

const composeCanvasData = () => ({
  labels: [...Array(PLOT_DATA_LENGTH).keys()],
  datasets: [
    { ...datasetTemplate.ax, data: accData.ax },
    { ...datasetTemplate.ay, data: accData.ay },
    { ...datasetTemplate.az, data: accData.az },
  ],
});

const composeConfig = () => ({
  type: "line",
  data: composeCanvasData(),
  options: { animation: false },
});

const drawCanvas = (accCanvas) => {
  updateAccelerationData();
  let accChart = new Chart(accCanvas, composeConfig()); // Draw the data to canvas
  return [accChart];
};

const delCanvas = (canvases) => {
  canvases.forEach((c) => c.destroy());
};

const main = () => {
  let canvases = null;
  setInterval(() => {
    if (canvases) delCanvas(canvases);
    canvases = drawCanvas(accCanvas);
  }, TIME_INTERVAL);
};

main();

/*
const data = {
  labels,
  datasets: [
    {
      label: "ax",
      backgroundColor: "rgb(47 119 185)",
      borderColor: "rgb(47 119 185)",
      data: [0, 10, 5, 2, 20, 30, 45],
    },
    {
      label: "ay",
      backgroundColor: "rgb(255, 99, 132)",
      borderColor: "rgb(255, 99, 132)",
      data: [0, 17, 8, 2, 18, 30, 70],
    },
    {
      label: "az",
      backgroundColor: "rgb(109 206 67)",
      borderColor: "rgb(109 206 67)",
      data: [0, 17, 8, 2, 18, 30, 70],
    },
  ],
};
*/
