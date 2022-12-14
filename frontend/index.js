/**
 * nvm use 18
 * npm install express
 * npm install cors
 * npm install @abandonware/noble
 */
const TIME_INTERVAL = 50;
const SENSITIVE = 0;

let ALARM_IS_PLAYING = false;

const endpoint = "http://127.0.0.1:3000";

const eleAlarmTime = document.querySelector('input[type="time"]');
const eleRemainTime = document.getElementById("remain-time");
const eleJumpingCountSelect = document.getElementById("jumping-count-select");
const eleJumpingCount = document.getElementById("remain-jumping-count");
const eleAlarmImg = document.getElementById("alarm-image");
const eleAudio = document.getElementById("alarm-audio");

const getDisplayTime = (date = new Date()) => `${date.getFullYear()}/${`0${date.getMonth() + 1}`.slice(-2)}/${date.getDate()} ${`0${date.getHours()}`.slice(-2)}:${`0${date.getMinutes()}`.slice(-2)}`;

const formatDisplayTime = (h, m, s) => `${`0${h}`.slice(-2)}:${`0${m}`.slice(-2)}:${`0${s}`.slice(-2)}`;

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

// const showWakeUpMessage = () => window.alert("Enjoy your day ??????????????????");
const showWakeUpMessage = () =>
  swal({
    title: "Enjoy your day ??????????????????",
    text: "You've done the jumping!",
    icon: "success",
    button: "Aww yiss!",
  });

const pauseAudio = () => eleAudio.pause();

const playAudio = () => eleAudio.play();

const shouldStopWakeUp = (count) => {
  return count >= eleJumpingCountSelect.value;
};

const shouldWakeUp = () => {
  const remainTime = getRemainTime();
  return remainTime < SENSITIVE || remainTime > 24 * 60 - 1; // The time will be reset to 24hours immediately after counting down to zero
};

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
    showWakeUpMessage();
  }
};

const tryTurnOnAlarm = () => {
  if (!ALARM_IS_PLAYING && shouldWakeUp()) {
    ALARM_IS_PLAYING = true;
    playAudio();
  }
};

const updateRemainTime = () => {
  const remainSecs = getRemainTime() * 60;
  const hours = parseInt(remainSecs / 3600);
  const mins = parseInt((remainSecs - 3600 * hours) / 60);
  const secs = parseInt(remainSecs - 3600 * hours - 60 * mins);
  eleRemainTime.innerText = formatDisplayTime(hours, mins, secs);
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
