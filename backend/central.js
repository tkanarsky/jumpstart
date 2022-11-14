/**
 * based on the example on https://www.npmjs.com/package/@abandonware/noble
 * nvm use 18
 * npm install express
 * npm install cors
 * npm install @abandonware/noble
 */

const noble = require("@abandonware/noble");

const uuid_service = "1101";
const uuid_value = ["2001", "2002", "2003", "2004", "2005", "2006"];

noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    console.log("start scanning");
    await noble.startScanningAsync([uuid_service], false);
  }
});

let accelerator_char;
noble.on("discover", async (peripheral) => {
  await noble.stopScanningAsync();
  await peripheral.connectAsync();

  const services = Array.isArray(uuid_service) ? uuid_service : [uuid_service];
  const chars = Array.isArray(uuid_value) ? uuid_value : [uuid_value];
  const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(services, chars);
  accelerator_char = characteristics;
  // console.log(accelerator_char, "!!!!!!!!!!!!!!!!!!");
});

let readData = async (characteristic) => {
  if (!characteristic) {
    console.log("Warning: Arduino's characteristic is null");
    return {};
  }

  const p0 = () => characteristic[0].readAsync();
  const p1 = () => characteristic[1].readAsync();
  const p2 = () => characteristic[2].readAsync();
  const p3 = () => characteristic[3].readAsync();
  const p4 = () => characteristic[4].readAsync();
  const p5 = () => characteristic[5].readAsync();

  const [axValue, ayValue, azValue, gxValue, gyValue, gzValue] = await Promise.all([p0(), p1(), p2(), p3(), p4(), p5()]);
  const sensorValues = {
    ax: axValue.readFloatLE(0),
    ay: ayValue.readFloatLE(0),
    az: azValue.readFloatLE(0),
    gx: gxValue.readFloatLE(0),
    gy: gyValue.readFloatLE(0),
    gz: gzValue.readFloatLE(0),
  };
  return sensorValues;
};

const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

app.options("*", cors());

app.get("/", async (req, res) => {
  const sensorValue = await readData(accelerator_char);
  console.log(new Date(), "Receive GET request. Query: ", req.query, ". Values: ", sensorValue, "!!!!!!!!!!");
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" });
  res.end(JSON.stringify({ sensorValue }));
});

// app.post("/", (req, res) => {
//   res.render("index");
//   res.writeHead(200, {
//     "Content-Type": "application/json",
//   });
//   res.end(
//     JSON.stringify({
//       sensorValue: sensorValue,
//     })
//   );
// });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
