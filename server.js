const express = require('express');
const routes = require('./routes');

const app = express();
let port = 5000;
if (process.env.PORT) {
  port = process.env.PORT;
}

app.use (express.json())
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
