import geolib from "geolib"
import fs from "fs"
import { RowDataPacket } from "mysql2";

export interface IEntity extends RowDataPacket {ID: string, NAME: string, LATITIUDE: number, LONGITUDE: number, PIC: string, FID: string}

export const getDist = (userLat:string, userLon:string, EntityList:any[]) => {
    var EntityDist:{dist: number, ENTITY: IEntity}[] = [];
    EntityList.forEach(ENT => {  
      EntityDist.push(
            {dist: calcCrow(Number(userLat), Number(userLon), ENT.LATITIUDE as number, ENT.LONGITUDE as number), 
            ENTITY: ENT as IEntity}
        );
    });
    return EntityDist;
}

export const writeToLog = (dataToWrite:string) => {
  fs.appendFile('log.txt', dataToWrite, function (err:any) {
    if (err) throw err;
    console.log('Saved!');
  });
}

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(lat1:number, lon1:number, lat2:number, lon2:number) 
{
  var R = 6371; // km
  var dLat = toRad(lat2-lat1);
  var dLon = toRad(lon2-lon1);
  var lat1 = toRad(lat1);
  var lat2 = toRad(lat2);

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c;
  return d;
}

// Converts numeric degrees to radians
function toRad(Value:number) 
{
    return Value * Math.PI / 180;
}

export function isNumeric(n:any) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}