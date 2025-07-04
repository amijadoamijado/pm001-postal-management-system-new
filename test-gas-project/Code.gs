function doGet() {
  return HtmlService.createHtmlOutput("Hello, clasp!");
}

function doPost() {
  return HtmlService.createHtmlOutput("Received a POST request!");
}

function runTest() {
  Logger.log("Test function executed successfully!");
}
