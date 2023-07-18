import express from "express"
import fileUpload from "express-fileupload"
import dotenv from "dotenv"
import mysql, { OkPacket, RowDataPacket } from "mysql2"
import bodyParser from "body-parser"
import https from "https"
import bcrypt from "bcrypt"
import fs from "fs"
import {IEntity, getDist, isNumeric} from "./helpers"
import { UploadedFile } from "express-fileupload"
import { randomUUID } from "crypto"
var privateKey  = fs.readFileSync('keys/privateKey.key', 'utf8');
var certificate = fs.readFileSync('keys/certificate.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

dotenv.config();

const app = express();

// DB CONNECTION
// --------------------------------------------------------------------
var connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});

connection.connect(function(err) {
  if (err) {
    console.error('Error Connecting: ' + err.stack);
    return;
  }
});


app.use(bodyParser.urlencoded({extended: false}));
app.use(fileUpload());

interface IUser extends RowDataPacket {
  USERNAME: string,
  PASSWORD: string
}

// Authorize header
app.use((req, res, next) => {
  var authheader = req.headers.authorization;
  if (!authheader) return res.status(401).json({message:"Authentication Needed"})
  
  var auth:any = Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
  var username = auth[0]; var pass = auth[1];

  connection.query<IUser[]>('SELECT `PASSWORD` FROM users WHERE `USERNAME` = ?', [username], function (error, results, fields) {
    if (error) res.status(500).send("error")
    bcrypt.compare(pass, results[0].PASSWORD, function(err, result) {
      if (result) next()
      else return res.status(401).json("WRONG CREDS")
    });
  })
})

app.get("/allATM", (req,res, next) => {
  connection.query('SELECT * FROM atmlocation', function (error, results, fields) {
    if (error) res.status(500).send("error")
    console.log(results)
    res.send(results)
  })
})
// /getPic?id=<>
app.get("/getPic", (req,res, next) => {
  var entityId = req.query.id
  // Find in Cache
  var fileList = fs.readdirSync(__dirname+'/upload_images')
  for (var i = 0; i < fileList.length; i++){
    var file = fileList[i]
    if (file.includes(entityId as string))
      return res.status(200).sendFile('./upload_images/'+entityId+'.jpg', { root: __dirname });
  }
  return res.status(400).json("NOT FOUND")
});

app.get("/allBranch", (req,res, next) => {
  connection.query('SELECT * FROM branchlocation', function (error, results, fields) {
    if (error) res.status(500).send("error")
    res.send(results)
  })
})
///closeATM?number=<>&lat=<>&long=<>
app.get("/closeATM", (req,res, next) => {
  var lat = req.query.lat
  var long = req.query.long
  var num = req.query.number
  
  if (!isNumeric(lat) || !isNumeric(long) || !isNumeric(num)) return res.status(403).json("Bad Input")
  connection.query('SELECT * FROM atmlocation', function (error, results, fields) {
    if (error) res.status(500).send("error")
    var ATM_DISTANCED = getDist(lat as string, long as string, results as any[]).sort((a, b) => a.dist - b.dist).slice(0,Number(num))
    res.send(ATM_DISTANCED)
  })
})
///closeBranch?number=<>&lat=<>&long=<>
app.get("/closeBranch", (req,res, next) => {
  var lat = req.query.lat
  var long = req.query.long
  var num = req.query.number
  
  if (!isNumeric(lat) || !isNumeric(long) || !isNumeric(num)) return res.status(403).json("Bad Input")
  connection.query('SELECT * FROM branchlocation', function (error, results, fields) {
    if (error) res.status(500).send("error")
    var BRANCH_DISTANCED = getDist(lat as string, long as string, results as any[]).sort((a, b) => a.dist - b.dist).slice(0,Number(num))
    res.send(BRANCH_DISTANCED)
  })
})
///CRUD/:type/:entity?id=<>&lat=<>&lon=<>&name=<>
app.post("/CRUD/:type/:entity", (req, res, next) => {
  var entityId = req.query.id
  var ent_lat = req.query.lat
  var ent_long = req.query.lon
  var ent_name = req.query.name

  switch (req.params.type) {
    case "DELETE":
      if (req.params.entity == "ATM") {
        connection.query(`DELETE FROM atmlocation WHERE TERMINAL_ID = "${entityId}"`, function (error) {
          if (error) throw error;
        })
        return res.status(200).json("OK")
      }
      else if (req.params.entity == "BRANCH") {
        connection.query(`DELETE FROM branchlocation WHERE BRANCH_CODE = "${entityId}"`, function (error) {
          if (error) throw error;
        })
        return res.status(200).json("OK")
      }
      break;
    case "CREATE":
      if (req.params.entity == "ATM") {
        connection.query(`INSERT INTO atmlocation (ID,TERMINAL_ID, LOCATION, LATITIUDE, LONGITUDE) VALUES (?,?,?,?,?)`,
        [ randomUUID(), entityId, ent_name, ent_lat, ent_long],
        function (error) {
          if (error) throw error;
        })
        return res.status(200).json("OK")
      }
      else if (req.params.entity == "BRANCH") {
        connection.query(`INSERT INTO branchlocation (ID, BRANCH_CODE, LOCATION, LATITIUDE, LONGITUDE) VALUES (?,?,?,?,?)`,
        [ randomUUID(), entityId, ent_name, ent_lat, ent_long],
        function (error) {
          if (error) throw error;
          else return res.status(200).json("OK")
        })
      }
      break;
    case "UPDATE":
      if (req.params.entity == "ATM") {
        connection.query(`UPDATE atmlocation SET LOCATION = COALESCE(?, LOCATION), LATITIUDE = COALESCE(?, LATITIUDE), LONGITUDE = COALESCE(?, LONGITUDE) WHERE TERMINAL_ID = ?`,
        [ent_name, ent_lat, ent_long, entityId],
        function (error) {
          if (error) throw error;
        })
        return res.status(200).json("OK")
      }
      else if (req.params.entity == "BRANCH") {
        connection.query(`UPDATE branchlocation SET LOCATION = COALESCE(?, LOCATION), LATITIUDE = COALESCE(?, LATITIUDE), LONGITUDE = COALESCE(?, LONGITUDE) WHERE BRANCH_CODE = ?`,
        [ent_name, ent_lat, ent_long, entityId],
        function (error) {
          if (error) throw error;
        })
        return res.status(200).json("OK")
      }
      break;
    default:
      break;
  }
})

// /upload?tid=<ATM>&enitity=<"ATM" | "BRANCH">
// type="file" name="sampleFile" 
// method='post' encType="multipart/form-data">
app.post("/upload", (req, res, next) => {
  let inputF:UploadedFile | UploadedFile[]
  let uploadPath;
  let tid = req.query.tid;
  let entity = req.query.entity;

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }
  // The name of the input field (i.e. "imputF") is used to retrieve the uploaded file
  inputF = req.files.sampleFile as UploadedFile;
  uploadPath = __dirname + '/upload_images/'+tid+'.jpg';

  // Use the mv() method to place the file somewhere on your server
  inputF.mv(uploadPath, function(err:any) {
    if (err)
      return res.status(500).send("error");
    
    // Add pic to ATM db
    if (entity == "ATM") {
      connection.query(`UPDATE atmlocation SET PIC="${tid+'.jpg'}",FID=NULL WHERE TERMINAL_ID = "${tid}"`, function (error) {
        if (error) throw error;
        return res.status(200).json("OK")
      })
    }
    else if (entity == "BRANCH") {
      connection.query(`UPDATE branchlocation SET PIC="${tid+'.jpg'}",FID=NULL WHERE BRANCH_CODE = "${tid}"`, function (error) {
        if (error) throw error;
        return res.status(200).json("OK")
      })
    }
  })
})

var httpsServer = https.createServer(credentials, app);

httpsServer.listen(443, () => {
  console.log("Listening on 443!")
});
