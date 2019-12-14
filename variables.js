const kafka = require('kafka-node')
const kafkaHost = '148.60.11.178:9092'
const topic = 'topicissa'
const offset = new kafka.Offset(new kafka.KafkaClient({kafkaHost: kafkaHost}))

const p = new Promise ((resolve)=>{
    offset.fetchLatestOffsets([topic],function(error,offsets){
        resolve(offsets[topic][0])
    })
})

exports.getOffset = p
exports.kafkaHost = kafkaHost
exports.topic= topic
exports.subdomain = 'rompion.esir.deuxfleurs.fr'
exports.identifier = 'reverseproxyissa'