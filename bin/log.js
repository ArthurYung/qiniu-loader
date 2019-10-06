const chalk = require("chalk");

const tagText = '[QiNiu Plugin]'

module.exports = {
    info(msg) {
        console.log(chalk`{blue.bold ${tagText} ${msg}}`)
    },
    warn(msg) {
        console.log(chalk`{yellow.bold ${tagText} ${msg}}`)
    },
    error(msg) {
        console.log(chalk`{red.bold ${tagText} ${msg}}`)
    },
    success(msg) {
        console.log(chalk`{green.bold ${tagText} ${msg}}`)
    }
} 
