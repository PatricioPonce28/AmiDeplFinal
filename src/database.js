// NOSQL === MONGODB 
// SERVER === ODM === Mongoose 

import mongoose from "mongoose" 


mongoose.set('strictQuery', true)

const connection = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI_PRODUCTION)
        console.log("Data is connected")
    }

    catch (error){
        console.log(error)
    }
}

export default connection