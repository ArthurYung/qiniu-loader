require("./css.css");
const jss = require("./b");
jss();
const j = 1;
for (let i = 0; i < 12; i++) {
  console.log(j);
}

var img1 = document.createElement("img");
img1.src = require("./myblog.jpg");
// img1.src = require("./monky2.jpg");
document.body.appendChild(img1);
