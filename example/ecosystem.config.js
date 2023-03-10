module.exports = {
  apps: [
    {
      name: "eventMonkeyBot",
      script: "dist/eventMonkeyBot.js",
      watch: ["./dist"],
      watch_delay: 1000,
      log_file: "logs/monkeyBotLog.txt"
    },
    {
      name: "eventMonkey Frontend",
      script: "dist/eventMonkeyFrontEnd.js",
      watch: ["./dist"],
      watch_delay: 1000,
    },
  ],
};
