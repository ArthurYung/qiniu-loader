const chalk = require("chalk").bold;

const tagText = "[QiNiu Plugin]";

module.exports = {
  info(msg) {
    console.log(chalk.blue(`${tagText} ${msg}`));
  },
  warn(msg) {
    console.log(chalk.yellow(`${tagText} ${msg}`));
  },
  error(msg) {
    console.log(chalk.red(`${tagText} ${msg}`));
  },
  success(msg) {
    console.log(chalk.green(`${tagText} ${msg}`));
  }
};
