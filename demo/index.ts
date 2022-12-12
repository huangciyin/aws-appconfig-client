import getConf from "../src/index.js";
import {config} from 'dotenv';
config()

getConf().then((result) => {
  console.log(result);
});
