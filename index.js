import http from "http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("HaniLink Standard HTTP Server is Running!");
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Standard HTTP Server running on http://localhost:3000");
});
