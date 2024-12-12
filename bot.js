

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
const express = require('express');
require('dotenv').config();


const { Table } = require('embed-table');

// Initialize the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const app = express();

// Port for the Express server
const PORT = process.env.PORT || 3000; // Use environment variable for dynamic port assignment

// CList API Key and URL for contests
const API_KEY = process.env.API_KEY; // Load API Key from .env
const API_URL = 'https://clist.by/api/v4/contest/';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = '1100431779573280820'; // Server where the bot will send the reminders
const CHANNEL_ID = '1316777596867969024'; // Channel where the bot will send the reminders
const API_BASE_URL = 'https://clist.by/api/v4/contest/';

const Reminder_ID = '1316797781771292692';
const Role_ID = '1316797575382171728';

// A set to track contests that have already been reminded
const remindedContests = new Set();

// Helper function to fetch the next contests from CList API
async function getNextContest() {
  try {
    const currentTime = new Date().toISOString().split('.')[0]; // "YYYY-MM-DDTHH:MM:SS"
    console.log(currentTime);

    const url = `https://clist.by/api/v4/contest/?start__gt=${currentTime}&order_by=start`;

    const headers = {
      Authorization: `${API_KEY}`,
    };

    // Mapping of resource IDs to platforms
    const id_to_platform = {
      2: 'Codechef',
      1: 'Codeforces',
      93: 'Atcoder',
      102: 'Leetcode',
      35: 'Google',
      73: 'Hackerearth',
      123: 'Codedrills',
      12: 'Topcoder',
      117: 'BinarySearch',
      126: 'geeksforgeeks',
    };

    // Fetch contests from the API
    const response = await axios.get(url, { headers });
    const contests = response.data.objects;

    // Filter contests based on resource_id being in id_to_platform keys
    const filteredContests = contests.filter(contest =>
      Object.keys(id_to_platform).includes(String(contest.resource_id))
    );

    return filteredContests;
  } catch (error) {
    console.error('Error fetching contests:', error.message);
    return [];
  }
}



var reminderChannel = client.channels.cache.get(Reminder_ID);


function formatContestTable(contests) {
  const maxPlatformLength = 15;  // Adjusted width for Platform
  const maxNameLength = 30;      // Adjusted width for Contest Name
  const maxDurLength = 7;        // Adjusted width for Duration (e.g., 1h 30m)
  const maxCountdownLength = 10; // Adjusted width for Countdown (e.g., "5h 25m")

  let table = '```diff\n'; // Start the code block in Discord Markdown
  table += `#  ${'Platform'.padEnd(maxPlatformLength)}  ${'Name'.padEnd(maxNameLength)}  ${'Dur'.padEnd(maxDurLength)}  ${'Countdown'.padEnd(maxCountdownLength)}\n`;
  table += `-  ${'-'.repeat(maxPlatformLength)}  ${'-'.repeat(maxNameLength)}  ${'-'.repeat(maxDurLength)}  ${'-'.repeat(maxCountdownLength)}\n`;

  contests.slice(0, 10).forEach((contest, index) => {
    const platform = contest.resource ? truncateText(contest.resource, maxPlatformLength) : ''.padEnd(maxPlatformLength);
    const contestName = contest.event ? truncateText(contest.event, maxNameLength) : ''.padEnd(maxNameLength);

    const duration = contest.duration ? formatDuration(contest.duration) : ''.padEnd(maxDurLength);

    // Format countdown to show hours and minutes based on current UTC time
    const countdown = contest.start ? formatCountdown(contest.start) : ''.padEnd(maxCountdownLength);

    table += `${(index + 1).toString().padStart(2)}  ${platform}  ${contestName}  ${duration}  ${countdown}\n`;
  });

  table += '```'; // End the code block
  return table;
}

// Function to truncate text and add ellipsis if it exceeds max length
function truncateText(text, maxLength) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...'; // Truncate with ellipsis
  }
  return text.padEnd(maxLength);  // Ensure the text takes up the full width
}

// Function to format duration in a simple format (like "2 hours" or "a day")
function formatDuration(durationInSeconds) {
  const duration = moment.duration(durationInSeconds, 'seconds');
  if (duration.asDays() >= 1) {
    return `${Math.floor(duration.asDays())} day${Math.floor(duration.asDays()) > 1 ? 's' : ''}`; // Show days if greater than or equal to 1 day
  } else if (duration.asHours() >= 1) {
    const hours = Math.floor(duration.asHours());
    return `${hours} hour${hours > 1 ? 's' : ''}`; // Display hours only
  } else {
    const minutes = duration.minutes();
    return `${minutes} minute${minutes > 1 ? 's' : ''}`; // Display minutes only
  }
}

// Function to format countdown in hours and minutes based on current UTC time
function formatCountdown(startTime) {
  const now = moment.utc(); // Current UTC time
  const start = moment.utc(startTime); // Contest start time (UTC)
  const duration = moment.duration(start.diff(now)); // Calculate the difference

  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();

  // If the contest has already started, show how long ago it started
  if (duration.asMilliseconds() < 0) {
    hours --;
    return `${-hours}h ${-minutes}m ago`; // Time passed
  }

  // Otherwise, show the time remaining in the future
  return `${hours}h ${minutes}m`; // Time remaining
}



console.log(reminderChannel);
var contestList;
// Function to check contests and send reminders
async function checkContestsAndRemind() {
  const contests = await getNextContest();
  contestList = contests;

  const now = moment.utc(); // Current UTC time
  // console.log(now);

  for (const contest of contests) {
    // console.log(contest);
    const contestStartTime = moment.utc(contest.start);
    const contestEndTime = moment(contest.end);

    var currentTime = new Date().toISOString().split('.')[0]; // "YYYY-MM-DDTHH:MM:SS"

    const currentTimeMinusOneHour = moment().subtract(0, 'hour');

    // const contestStartTime = moment(contest.start); // Contest start time (already in UTC)
    


    // Calculate the time difference in minutes
    const timeDifference = contestStartTime.diff(now, 'minutes');

    // console.log(contest.event, contestStartTime.format('YYYY-MM-DD HH:mm:ss'), timeDifference);

    // Check if the contest is starting within the next 60 minutes and hasn't been reminded
    if (timeDifference > 0 && timeDifference <= 60 && !remindedContests.has(contest.id)) {

      console.log(contest.event, contestStartTime.format('YYYY-MM-DD HH:mm:ss'), timeDifference);
      // Format the contest message
      const countdown = formatCountdown(contest.start);
      const reminderMessage = `📢 <@&${Role_ID}> **Reminder!**  
**${contest.event}** is starting soon!  
⏰ Countdown: ${countdown}  
🌐 Platform: ${contest.resource}  
🔗 [Join the contest](${contest.href})`;

      // Send the reminder message
      if (reminderChannel) {
        reminderChannel.send(reminderMessage);
      }

      else
      {
        console.log('Reminder channel not found');
      }

      // Add the contest to the remindedContests set
      remindedContests.add(contest.id);
    }


    // console.log(contest.event, contestStartTime.format('YYYY-MM-DD HH:mm:ss'));

    // If the contest is starting in the next hour, set a reminder
    // const oneHourBefore = contestStartTime.subtract(1, 'hour');

    // // Check if the contest is within the 1-2 weeks range and if it hasn't been reminded yet
    // if (oneHourBefore.isAfter(moment()) && oneHourBefore.diff(moment()) < 2 * 7 * 24 * 60 * 60 * 1000) {
    //   const timeUntilStart = oneHourBefore.fromNow();
    //   const contestMessage = `${contest.event} is starting in 1 hour! [Link to contest](${contest.href})`;

    //   // If the contest has not been reminded yet
    //   if (!remindedContests.has(contest.id)) {
    //     console.log(contestMessage);
        
    //     // Calculate the timeout and prevent overflow
    //     const timeoutDuration = oneHourBefore.diff(moment());
    //     // console.log(timeoutDuration);
    //     if (timeoutDuration > 0 && timeoutDuration <= 2147483647) {
    //       setTimeout(() => {
    //         client.channels.cache.get(CHANNEL_ID)?.send(contestMessage);
    //         // Mark the contest as reminded
    //         remindedContests.add(contest.id);
    //       }, timeoutDuration);
    //     }
    //   }
    // }
    
  }
}

// Function to send the contest message to Discord
function updateContestMessage(contests = contestList) {
  const channel = client.channels.cache.get(CHANNEL_ID);
  const table = formatContestTable(contests);

  // Check if the message already exists, and update it
  channel.messages.fetch({ limit: 1 }).then(messages => {
    const lastMessage = messages.first();
    if (lastMessage) {
      lastMessage.edit(table); // Edit the last message
    } else {
      channel.send(table); // Send the table if no message exists
    }
  });
}

// Update the message every minute (60000 milliseconds)

setInterval(updateContestMessage, 60000);


// Start checking contests every 30 minutes
client.once('ready', async () => {
  console.log('Bot is online!');
  reminderChannel = client.channels.cache.get(Reminder_ID);
  await checkContestsAndRemind();
  setInterval(checkContestsAndRemind, 30 * 60 * 1000); // 30 minutes interval

  
});

// Log in to Discord and start the bot
client.login(DISCORD_TOKEN);



// Set up Express server to handle web requests
app.get('/', (req, res) => {
  res.send('Hello, this is your bot server!');
});

// Start the web server
app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
});

