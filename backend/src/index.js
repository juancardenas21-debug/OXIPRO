const app = require('./app');

app.listen(process.env.PORT, () => {
  console.log(`API en http://localhost:${process.env.PORT}`);
});
