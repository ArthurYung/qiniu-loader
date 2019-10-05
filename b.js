module.exports = function() {
  console.log("test");

  var img1 = document.createElement("img");
  img1.src = require("./assets/myblog2.jpg");
  // img1.src = require("./monky2.jpg");
  document.body.appendChild(img1);
};
