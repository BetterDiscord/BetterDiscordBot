const msInSecond = 1000;
const msInMinute = msInSecond * 60;
const msInHour = msInMinute * 60;
const msInDay = msInHour * 24;

export function humanReadableUptime(uptime) {
    let remainder = uptime;
    const days = Math.floor(uptime / msInDay);
    remainder = remainder - (days * msInDay);
    const hours = Math.floor(remainder / msInHour);
    remainder = remainder - (hours * msInHour);
    const minutes = Math.floor(remainder / msInMinute);
    remainder = remainder - (minutes * msInMinute);
    const seconds = Math.floor(remainder / msInSecond);

    let humanReadable = `${seconds}s`;
    if (minutes) humanReadable = `${minutes}m ${humanReadable}`;
    if (hours) humanReadable = `${hours}h ${humanReadable}`;
    if (days) humanReadable = `${days}d ${humanReadable}`;
    return humanReadable;
}
