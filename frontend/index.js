/**
 * nvm use 18
 * npm install express
 * npm install cors
 * npm install @abandonware/noble
 */
const TIME_INTERVAL = 400;
const SENSITIVE = 0.5;

let ALARM_IS_PLAYING = false;

const endpoint = "http://127.0.0.1:3000";

const eleAlarmTime = document.querySelector('input[type="time"]');
const eleRemainTime = document.getElementById("remain-time");
const eleJumpingCountSelect = document.getElementById("jumping-count-select");
const eleJumpingCount = document.getElementById("remain-jumping-count");
const eleAlarmImg = document.getElementById("alarm-image");
const eleAudio = document.getElementById("alarm-audio");

const getDisplayTime = (date = new Date()) => `${date.getFullYear()}/${`0${date.getMonth() + 1}`.slice(-2)}/${date.getDate()} ${`0${date.getHours()}`.slice(-2)}:${`0${date.getMinutes()}`.slice(-2)}`;

const getTimeDiff = (time1, time2) => (time1.getTime() - time2.getTime()) / (1000 * 60); // measured in minutes

const getLatestData = async () => {
  let val = {};
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
  // console.log(val, "#########"); // Uncomment this line for debugging
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
    alarmTime.setDate(alarmTime.getDate() + 1); // Add one day
    val = getTimeDiff(alarmTime, new Date());
  }
  return val; // in minutes
};

const flashAlarmImg = () => {
  const nextSrc = eleAlarmImg.src.includes("01.png") ? "alarm02.png" : "alarm01.png";
  eleAlarmImg.src = nextSrc;
};

const resetAlarmImg = () => {
  eleAlarmImg.src = "alarm01.png";
};

const shouldStopWakeUp = (count) => {
  return count >= eleJumpingCountSelect.value;
};

const shouldWakeUp = () => {
  const remainTime = getRemainTime();
  return remainTime < SENSITIVE;
};

const playAudio = () => eleAudio.play();

const pauseAudio = () => eleAudio.pause();

const tryTurnOffAlarm = async () => {
  const { count } = await getLatestData();
  // console.log(count, typeof count !== "undefined", !isNaN(count), !Number.isNaN(count), eleJumpingCountSelect.value);

  if (!isNaN(count)) {
    updateRemainCount(eleJumpingCountSelect.value - count);
  }

  flashAlarmImg();

  const res = await shouldStopWakeUp(count ?? 0);
  if (res) {
    ALARM_IS_PLAYING = false;
    resetAlarmImg();
    pauseAudio();
  }
};

const tryTurnOnAlarm = () => {
  if (!ALARM_IS_PLAYING && shouldWakeUp()) {
    ALARM_IS_PLAYING = true;
    playAudio();
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

const alarmTimeOnChange = (_) => updateRemainTime();

const jumpingCountOnChange = (evt) => updateRemainCount(evt.target.value);

const initValues = () => {
  updateRemainTime();
  updateRemainCount(eleJumpingCountSelect.value);
};

const addEventListeners = () => {
  eleAlarmTime.addEventListener("change", alarmTimeOnChange);
  eleJumpingCountSelect.addEventListener("change", jumpingCountOnChange);
};

addEventListeners();
initValues();
runDaemons();
