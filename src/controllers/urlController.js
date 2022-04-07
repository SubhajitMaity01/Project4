const urlModel = require('../models/urlModel');
const validUrl = require('valid-url')
const shortid = require('shortid')
const redis = require("redis");
const { promisify } = require("util");

// Validation
const isValidBody = function (body) {
    return Object.keys(body).length > 0;
}

const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false; 
    if (typeof value === 'string' && value.trim().length === 0) return false;
    return true
}

//Connect to redis
const redisClient = redis.createClient(
    11266,
  "redis-11266.c80.us-east-1-2.ec2.cloud.redislabs.com",
  { no_ready_check: true }
);
redisClient.auth("chRGSwUhbKJjbi1Z0dWVD3iMkfwIbPnF", function (err) {
  if (err) throw err;
});

redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});



//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);



const createUrl = async function (req, res){
    

 try{
        const data = req.body
        const{longUrl}= data
        if(!isValidBody(data)){
            return res.status(400).send({status:false,message:"data is required"})
        }
        if(!isValid(longUrl)){
            return res.status(400).send({status:false,message:"long url should be present"})
        }





      //we first check into the cache memory wheather the data is present or not into the cache memory or not

      let check = await GET_ASYNC(`${longUrl}`)
      if (check) {
          let response = JSON.parse(check)
          console.log("data is from cache")
          return res.status(200).send(response)
      }

      // check long url if valid using the validUrl.isUri method
      if (validUrl.isUri(longUrl)) {
        
            /* The findOne() provides a match to only the subset of the documents 
            in the collection that match the query. In this case, before creating the short URL,
            we check if the long URL was in the DB ,else we create it.
            */


          //if the data is not find into the cache memory it will go to the DB and search there
        //if that data is present into the DB we will return the data and at the same time we store that data into cache  

            let url = await urlModel.findOne({longUrl: longUrl}).select({longUrl:1, shortUrl:1, urlCode:1, _id:0})
            if(url) {
                await SET_ASYNC(`${longUrl}`, JSON.stringify(url))
                console.log(" data is from mongodb")
                return res.status(200).send({status: true, data: url})
            } 
            // if the long url is new 
             else {
                const baseUrl = 'http://localhost:3000'
                

            // check base url if valid using the validUrl.isUri method
              if (!validUrl.isUri(baseUrl)) {
                    return res.status(401).json('Invalid base URL')
                }
                // if valid, we create the url code
                const urlCode = shortid.generate()

                // join the generated short code the the base url
                const shortUrl = baseUrl + '/' + urlCode

            
                let input = {
                    longUrl:data.longUrl,
                    shortUrl:shortUrl,
                    urlCode:urlCode,
                }
                const newUrl= await urlModel.create(input)
                const finalUrl = {longUrl: newUrl.longUrl,shortUrl:newUrl.shortUrl,urlCode:newUrl.urlCode}
                
                return res.status(201).send({status:true, message:finalUrl})
            }
        
       
        } else {
         return res.status(401).send({status:false,message:" invalid url "})
      }
    }
     // exception handler
     catch (err) {
        return res.status(500).send({status:false,message:err.message})
     }


    
}




const redirect = async function(req,res) {
    try {
        const urlCode = req.params.urlCode

        // Validate params(it must be present)
        if(!isValid(urlCode.toLowerCase())) {
            return res.status(400).send({status: false, msg: "Please provide urlCode"})
        }
        
        // Validate query(if it is present return false)
        const query = req.query;
        if(isValidBody(query)) {
            return res.status(400).send({ status: false, msg: " Query will not be present"});
        }

       // Validate body(if it is present return false)
       if(isValidBody(req.body)) {
           return res.status(400).send({status: false, msg: "Body will not be present"})
       }

        
       
    //we first check into the cache memory wheather the data is present or not into the cache memory or not

        let check = await GET_ASYNC(`${urlCode}`);
        if(check) {
            let response = JSON.parse(check);
            console.log("from cache");
            return res.status(302).redirect(response.longUrl)
        }

//if the data is not find into the cache memory it will go to the DB and search there
 //if that data is present into the DB we will return the data and at the same time we store that data into cache
        const url = await urlModel.findOne({urlCode: urlCode})
        if(url) {
            await SET_ASYNC(`${urlCode}`, JSON.stringify(url));
            console.log("from mongoDB");
            return res.status(302).redirect(url.longUrl);
        } else{
            return res.status(404).send({status: false, msg: "No urlCode matches"})
        }
    }
    catch (err) {
        console.log("This is the error :", err.message)
        return res.status(500).send({status: false, msg:err.message })
    }



}

module.exports.createUrl=createUrl
module.exports.redirect=redirect
