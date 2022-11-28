// based on the example on https://www.npmjs.com/package/@abandonware/noble

const noble = require('@abandonware/noble');
const express = require('express')

const uuid_service = "1200"
const uuid_value = "2101"

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    
    console.log("start scanning")
    await noble.startScanningAsync([uuid_service], false);
  }
});

let accelerator;
noble.on('discover', async (peripheral) => {
  await noble.stopScanningAsync();
  await peripheral.connectAsync();
  const {characteristics} = await peripheral.discoverSomeServicesAndCharacteristicsAsync([uuid_service], [uuid_value]);
  accelerator = characteristics;
});

// read data periodically
//
let readData = async (characteristic) => {
  if(!characteristic) {
    return {};
  }
  const value = await characteristic[0].readAsync();
  console.log(value.readFloatLE(0));
  return value.readFloatLE(0);
}


const app = express()
const port = 3000


app.get('/', async(req, res) => {
  const value = await readData(accelerator);
  console.log(new Date(), "GET REQUEST");
  res.end(JSON.stringify({ value }));
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})