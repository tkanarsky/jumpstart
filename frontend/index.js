/**
 * nvm use 18
 * npm install express
 * npm install cors
 * npm install @abandonware/noble
 */
const endpoint = "http://127.0.0.1:3000";
const TIME_INTERVAL = 400;

let ALARM_IS_PLAYING = false;

const eleAlarmTime = document.querySelector('input[type="time"]');
const eleRemainTime = document.getElementById("remain-time");
const eleJumpingCountSelect = document.getElementById("jumping-count-select");
const eleJumpingCount = document.getElementById("remain-jumping-count");

const getDisplayTime = (date = new Date()) => `${date.getFullYear()}/${`0${date.getMonth() + 1}`.slice(-2)}/${date.getDate()} ${`0${date.getHours()}`.slice(-2)}:${`0${date.getMinutes()}`.slice(-2)}`;

const getTimeDiff = (time1, time2) => (time1.getTime() - time2.getTime()) / (1000 * 60); // measured in minutes

const getLatestData = async () => {
  let val = 0;
  const f = fetchData(endpoint, { method: "GET" });
  await f
    .then((resp) => {
      if (!resp.ok) {
        throw new Error("not ok");
      }
      return resp.json();
    })
    .then((json) => {
      // console.log(json.sensorValue);
      val = json.sensorValue;
    })
    .catch((err) => console.log(err));
  console.log(val, "#########");
  return val;
};

const getAlarmTime = () => {
  const tmp = new Date();
  tmp.setHours(eleAlarmTime.value.split(":")[0]);
  tmp.setMinutes(eleAlarmTime.value.split(":")[1]);
  tmp.setSeconds("0");
  return tmp;
};

const getRemainTime = () => {
  const alarmTime = getAlarmTime();

  const timeDiff = getTimeDiff(alarmTime, new Date());
  let val = "";
  if (timeDiff >= 0) {
    val = timeDiff; // Is in the same day
  } else {
    alarmTime.setDate(alarmTime.getDate() + 1);
    val = getTimeDiff(alarmTime, new Date());
  }
  return val; // in minutes
};

const shouldStopWakeUp = (count) => {
  // console.log(count, eleJumpingCountSelect.value, typeof count !== "undefined", "!!!!!!!!!!!");
  return typeof count !== "undefined" && count >= eleJumpingCountSelect.value;
};

const shouldWakeUp = () => {
  const remainTime = getRemainTime();
  return remainTime < 0.5;
};

const tryTurnOffAlarm = async () => {
  const { count } = await getLatestData();
  // console.log(count, !isNaN(count), !Number.isNaN(count), eleJumpingCountSelect.value, "########");

  if (!isNaN(count)) {
    // Use isNaN instead of Number.isNaN
    updateRemainCount(eleJumpingCountSelect.value - count);
  }

  const res = await shouldStopWakeUp(count);
  if (res) {
    ALARM_IS_PLAYING = false;
  }
};

const tryTurnOnAlarm = () => {
  if (!ALARM_IS_PLAYING && shouldWakeUp()) {
    ALARM_IS_PLAYING = true;
  }
};

const updateRemainTime = () => {
  const remainTime = getRemainTime();
  const hours = parseInt(remainTime / 60);
  const mins = (remainTime - 60 * hours).toFixed(2);
  eleRemainTime.innerText = `${hours} hours and ${mins} mins`;
};

const updateRemainCount = (val) => {
  eleJumpingCount.innerText = val;
};

const runDaemons = () => {
  setInterval(() => {
    updateRemainTime();

    if (ALARM_IS_PLAYING) {
      tryTurnOffAlarm();
    } else {
      tryTurnOnAlarm();
    }
  }, TIME_INTERVAL);
};

const alarmTimeOnChange = (evt) => updateRemainTime();

const jumpingCountOnChange = (evt) => updateRemainCount(evt.target.value);

const initialValues = () => {
  updateRemainTime();
  updateRemainCount(eleJumpingCountSelect.value);
};

const addEventListeners = () => {
  eleAlarmTime.addEventListener("change", alarmTimeOnChange);
  eleJumpingCountSelect.addEventListener("change", jumpingCountOnChange);
};

addEventListeners();
initialValues();
runDaemons();
