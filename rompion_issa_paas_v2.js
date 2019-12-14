"use strict"

const variables = require('./variables')
const http = require('http');
const fs = require('fs');
const kafka = require('kafka-node')
const Consumer = kafka.Consumer
const consumer = new Consumer(
  new kafka.KafkaClient({kafkaHost: variables.kafkaHost}),
    [
        { topic: variables.topic, partitions: 1 }
    ],
    {
        autoCommit: false
    }
);

variables.getOffset.then(lastoffset=>{

  consumer.on('message', function (message) {
    if(message.offset >= lastoffset && message.value){
      let msg = JSON.parse(message.value)
      if(msg.action && msg.repository){
        let action = msg.action
        let url = msg.repository

        switch(action) {
          case 'start':
            createJob(url)
            break;
          case 'stop':
            stopJob(url)
            break;
          default:
            console.error('Unknown action')
        }
      }
    }
  });

  consumer.on('error', function (err) {
    console.log('error', err);
  });

});

function createJob(url){
    var data = JSON.parse(fs.readFileSync('rompion_paas_task_deploy.json', 'utf8').toString());
    let id = url.split('/')[3]+url.split('/')[4]+'Issa'
    data.Job.ID = id
    data.Job.TaskGroups[0].Tasks[0].Config.args[0] = url;
    data.Job.TaskGroups[0].Tasks[0].Config.args[1] = "app";

    const options = {
      hostname: '148.60.11.202',
      port: 4646,
      path: '/v1/jobs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    const req = http.request(options, (res) => {
      console.log(`statusCode: ${res.statusCode}`)
      var str = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        str += d
      })
      res.on('end', function() {
        var result = JSON.parse(str);
        if(result){
          submit(url,'started')
          setTimeout(function(){getAllocationID(id)},3000)
        }
    });
    })
    
    req.on('error', (error) => {
      console.error(error)
    })
    
    req.write(JSON.stringify(data))
    req.end()
}

function stopJob(url){
  let id = url.split('/')[3]+url.split('/')[4]+'Issa'
  const options = {
    hostname: '148.60.11.202',
    port: 4646,
    path: '/v1/job/'+id,
    method: 'DELETE'
  }
  
  const req = http.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)
    var str = '';
    res.setEncoding('utf8');
    res.on('data', (d) => {
      str += d
    })
    res.on('end', function() {
      var result = str
      if(result){
        submit(url,'stopped')
        submit_unready()
      }
  });
})
  
  req.on('error', (error) => {
    console.error(error)
  })
  
  req.write('')
  req.end()
}

function submit(url,state){
  console.log('submit',url,state)
  const Producer = kafka.Producer;
  const producer = new Producer(new kafka.KafkaClient({kafkaHost: variables.kafkaHost}), { requireAcks: 1 })
  producer.on('ready', function () {
      let payloads = [
          {
            topic: variables.topic,
            messages: JSON.stringify({
              state : state,
              repository : url
            })
          }
        ];
        producer.send(payloads, (err, data) => {
          if (err) {
            console.log('[kafka-producer -> '+variables.topic+']: broker update failed');
          } else {
            console.log('[kafka-producer -> '+variables.topic+']: broker update success');
          }
        });
  });

  producer.on('error', function (err) {
    console.log('error', err);
  })
}

function getAllocationID(job_id){
  const options = {
    hostname: '148.60.11.202',
    port: 4646,
    path: '/v1/job/'+job_id+'/allocations',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  const req = http.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)
    var str = '';
    res.setEncoding('utf8');
    res.on('data', (d) => {
      str += d
    })
    res.on('end', function() {
      var result = JSON.parse(str);
      if(result){
        for (let i = 0; i <= result.length; i++) {
          if (result[i].TaskStates.serverissa.State === 'running'){
            getAllocations(result[i].ID)
            break;
          }else if (i == result.length){
            setTimeout(function(){ready(job_id)},3000)
          }
        }
      }else{
        setTimeout(function(){ready(job_id)},3000)
      }
  });
  })
  
  req.on('error', (error) => {
    console.error(error)
  })

  req.end()
}

function getAllocations(alloc_id){
  const options = {
    hostname: '148.60.11.202',
    port: 4646,
    path: '/v1/allocation/'+alloc_id,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  const req = http.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)
    var str = '';
    res.setEncoding('utf8');
    res.on('data', (d) => {
      str += d
    })
    res.on('end', function() {
      var result = JSON.parse(str);
      if(result){
        result.AllocatedResources.Tasks.serverissa.Networks.forEach(network => {
           let ip = network.IP 
           network.DynamicPorts.forEach(p => {
             let port = p.Value
             let target = ip+':'+port
             console.log('Allocations : ',target)
             submit_ready(target)
           })
         });
      }
  });
  })
  
  req.on('error', (error) => {
    console.error(error)
  })

  req.end()
}

function submit_ready(target){
  const Producer = kafka.Producer;
  const producer = new Producer(new kafka.KafkaClient({kafkaHost: variables.kafkaHost}), { requireAcks: 1 })
  producer.on('ready', function () {
      let payloads = [
          {
            topic: variables.topic,
            messages: JSON.stringify({
              action : 'ready',
              target : target,
              subdomain : variables.subdomain,
              identifier : variables.identifier
            })
          }
        ];
        producer.send(payloads, (err, data) => {
          if (err) {
            console.log('[kafka-producer -> '+variables.topic+']: broker update failed');
          } else {
            console.log('[kafka-producer -> '+variables.topic+']: broker update success');
          }
        });
  });

  producer.on('error', function (err) {
    console.log('error', err);
  })
}

function submit_unready(){
  const Producer = kafka.Producer;
  const producer = new Producer(new kafka.KafkaClient({kafkaHost: variables.kafkaHost}), { requireAcks: 1 })
  producer.on('ready', function () {
      let payloads = [
          {
            topic: variables.topic,
            messages: JSON.stringify({
              action : 'unready',
              identifier : variables.identifier
            })
          }
        ];
        producer.send(payloads, (err, data) => {
          if (err) {
            console.log('[kafka-producer -> '+variables.topic+']: broker update failed');
          } else {
            console.log('[kafka-producer -> '+variables.topic+']: broker update success');
          }
        });
  });

  producer.on('error', function (err) {
    console.log('error', err);
  })
}
