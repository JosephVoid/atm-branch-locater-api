import express from "express";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import mysql, { RowDataPacket } from "mysql2";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import fs from "fs";
import { getDist, isNumeric } from "./helpers";
import { UploadedFile } from "express-fileupload";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();

// DB CONNECTION
// --------------------------------------------------------------------
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

connection.connect(function (err) {
  if (err) {
    console.error("Error Connecting: " + err.stack);
    return;
  }
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

interface IUser extends RowDataPacket {
  USERNAME: string;
  PASSWORD: string;
}

// Authorize header
app.use((req, res, next) => {
  const authheader = req.headers.authorization;
  if (!authheader)
    return res.status(401).json({ message: "Authentication Needed" });
  try {
    const auth: any = Buffer.from(authheader, "base64")
    .toString()
    .split(":");
    const username = auth[0];
    const pass = auth[1];

    connection.query<IUser[]>(
      "SELECT `PASSWORD` FROM users WHERE `USERNAME` = ?",
      [username],
      function (error, results, fields) {
        if (error) res.status(500).json("error");
        try {
          bcrypt.compare(pass, results[0].PASSWORD, function (err, result) {
            if (result) next();
            else return res.status(401).json("WRONG CREDS");
          });
        } catch (error) {
          return res.status(403).json({err: "Please provide proper authorization"});
        }
      }
    );
  } catch (error) {
    console.log(error);
    return res.status(403).json({err: "Please provide proper authorization"});
  }

});

app.get("/allATM", (req, res, next) => {
  connection.query(
    "SELECT * FROM atmlocation",
    function (error, results, fields) {
      if (error) res.status(500).send("error");
      console.log(results);
      res.send(results);
    }
  );
});
// /getPic?id=<>
app.get("/getPic", (req, res, next) => {
  const entityId = req.query.id;
  // Find in Cache
  const fileList = fs.readdirSync(__dirname + "/upload_images");
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.includes(entityId as string))
      return res
        .status(200)
        .sendFile("./upload_images/" + entityId + ".jpg", { root: __dirname });
  }
  return res.status(400).json("NOT FOUND");
});

app.get("/allBranch", (req, res, next) => {
  connection.query(
    "SELECT * FROM branchlocation",
    function (error, results, fields) {
      if (error) res.status(500).send("error");
      res.send(results);
    }
  );
});
///closeATM?number=<>&lat=<>&long=<>
app.get("/closeATM", (req, res, next) => {
  const lat = req.query.lat;
  const long = req.query.long;
  const num = req.query.number;

  if (!isNumeric(lat) || !isNumeric(long) || !isNumeric(num))
    return res.status(403).json("Bad Input");
  connection.query(
    "SELECT * FROM atmlocation",
    function (error, results, fields) {
      if (error) res.status(500).send("error");
      const ATM_DISTANCED = getDist(
        lat as string,
        long as string,
        results as any[]
      )
        .sort((a, b) => a.dist - b.dist)
        .slice(0, Number(num));
      res.send(ATM_DISTANCED);
    }
  );
});
///closeBranch?number=<>&lat=<>&long=<>
app.get("/closeBranch", (req, res, next) => {
  const lat = req.query.lat;
  const long = req.query.long;
  const num = req.query.number;

  if (!isNumeric(lat) || !isNumeric(long) || !isNumeric(num))
    return res.status(403).json("Bad Input");
  connection.query(
    "SELECT * FROM branchlocation",
    function (error, results, fields) {
      if (error) res.status(500).send("error");
      const BRANCH_DISTANCED = getDist(
        lat as string,
        long as string,
        results as any[]
      )
        .sort((a, b) => a.dist - b.dist)
        .slice(0, Number(num));
      res.send(BRANCH_DISTANCED);
    }
  );
});
///CRUD/:type/:entity?id=<>&lat=<>&lon=<>&name=<>&fid=<>&pic=<>
app.post("/CRUD/:type/:entity", (req, res, next) => {
  const entityId = req.query.id;
  const ent_lat = req.query.lat;
  const ent_long = req.query.lon;
  const ent_name = req.query.name;
  const ent_fid = req.query.fid;
  const ent_pic = req.query.pic;

  switch (req.params.type) {
    case "DELETE":
      if (req.params.entity == "ATM") {
        connection.query(
          `DELETE FROM atmlocation WHERE TERMINAL_ID = "${entityId}"`,
          function (error) {
            if (error) throw error;
          }
        );
        return res.status(200).json("OK");
      } else if (req.params.entity == "BRANCH") {
        connection.query(
          `DELETE FROM branchlocation WHERE BRANCH_CODE = "${entityId}"`,
          function (error) {
            if (error) throw error;
          }
        );
        return res.status(200).json("OK");
      }
      break;
    case "CREATE":
      if (req.params.entity == "ATM") {
        connection.query(
          `INSERT INTO atmlocation (ID,TERMINAL_ID, LOCATION, LATITIUDE, LONGITUDE) VALUES (?,?,?,?,?)`,
          [randomUUID(), entityId, ent_name, ent_lat, ent_long],
          function (error) {
            if (error) throw error;
          }
        );
        return res.status(200).json("OK");
      } else if (req.params.entity == "BRANCH") {
        connection.query(
          `INSERT INTO branchlocation (ID, BRANCH_CODE, LOCATION, LATITIUDE, LONGITUDE) VALUES (?,?,?,?,?)`,
          [randomUUID(), entityId, ent_name, ent_lat, ent_long],
          function (error) {
            if (error) throw error;
            else return res.status(200).json("OK");
          }
        );
      }
      break;
    case "UPDATE":
      if (req.params.entity == "ATM") {
        connection.query(
          `UPDATE atmlocation SET LOCATION = COALESCE(?, LOCATION), LATITIUDE = COALESCE(?, LATITIUDE), LONGITUDE = COALESCE(?, LONGITUDE), FID = COALESCE(?, FID), PIC = COALESCE(?, PIC) WHERE TERMINAL_ID = ?`,
          [ent_name, ent_lat, ent_long, ent_fid, ent_pic, entityId],
          function (error) {
            if (error) throw error;
          }
        );
        return res.status(200).json("OK");
      } else if (req.params.entity == "BRANCH") {
        connection.query(
          `UPDATE branchlocation SET LOCATION = COALESCE(?, LOCATION), LATITIUDE = COALESCE(?, LATITIUDE), LONGITUDE = COALESCE(?, LONGITUDE), FID = COALESCE(?, FID), PIC = COALESCE(?, PIC) WHERE BRANCH_CODE = ?`,
          [ent_name, ent_lat, ent_long, ent_fid, ent_pic, entityId],
          function (error) {
            if (error) throw error;
          }
        );
        return res.status(200).json("OK");
      }
      break;
    default:
      break;
  }
});

// /upload?tid=<ATM>&enitity=<"ATM" | "BRANCH">
// type="file" name="sampleFile"
// method='post' encType="multipart/form-data">
app.post("/upload", (req, res, next) => {
  const tid = req.query.tid;
  const entity = req.query.entity;

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }
  // The name of the input field (i.e. "imputF") is used to retrieve the uploaded file
  const inputF: UploadedFile | UploadedFile[] = req.files
    .sampleFile as UploadedFile;
  const uploadPath = __dirname + "/upload_images/" + tid + ".jpg";

  // Use the mv() method to place the file somewhere on your server
  inputF.mv(uploadPath, function (err: any) {
    if (err) return res.status(500).send("error");

    // Add pic to ATM db
    if (entity == "ATM") {
      connection.query(
        `UPDATE atmlocation SET PIC="${
          tid + ".jpg"
        }",FID=NULL WHERE TERMINAL_ID = "${tid}"`,
        function (error) {
          if (error) throw error;
          return res.status(200).json("OK");
        }
      );
    } else if (entity == "BRANCH") {
      connection.query(
        `UPDATE branchlocation SET PIC="${
          tid + ".jpg"
        }",FID=NULL WHERE BRANCH_CODE = "${tid}"`,
        function (error) {
          if (error) throw error;
          return res.status(200).json("OK");
        }
      );
    }
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${process.env.PORT}`);
});
