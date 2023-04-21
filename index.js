const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const express = require("express");
const serverless = require("serverless-http");

const app = express();

const CONTACTS_TABLE = process.env.CONTACTS_TABLE;
const client = new DynamoDBClient();
const dynamoDbClient = DynamoDBDocumentClient.from(client);

app.use(express.json());

app.get("/contacts/:type", async function (req, res) {

  // requirement #4 - get all contacts in alphabetical order
  if (req.params.type === "all") {
    const params = {
      TableName: CONTACTS_TABLE,
      ScanIndexForward: false
    };
  
    try {
      const data = await dynamoDbClient.send(new ScanCommand(params));
      if (data.Items.length > 0) {
        const sortedContacts = data.Items.sort((a, b) => {
          const nameA = a.name.toUpperCase(); // ignore upper and lowercase
          const nameB = b.name.toUpperCase(); // ignore upper and lowercase
          if (nameA < nameB) {
            return -1;
          }
          if (nameA > nameB) {
            return 1;
          }
          return 0;
        })
        res.json({ sortedContacts });
      } else {
        res.json({ message: "No contacts created yet" })
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Could not retrieve all contacts" });
    }
    
  } else if (req.params.type === 'recent') { // requirement #5 - get 5 latest created contact
    const params = {
      TableName: CONTACTS_TABLE,
      Limit: 5,
    };
  
    try {
      const data = await dynamoDbClient.send(new ScanCommand(params));
      if (data.Items.length > 0) {
        var contacts = [];
        data.Items.forEach((contact) => {
          contacts.push(contact);
        });
        res.json({ contacts });
      } else {
        res.json({ message: "No contacts created yet" })
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Could not retrieve latest contacts" });
    }

  } else { // requirement #3 (READ) - get contact according to name
    const params = {
      TableName: CONTACTS_TABLE,
      Key: {
        name: req.params.type
      }
    };
  
    try {
      const { Item } = await dynamoDbClient.send(new GetCommand(params));
      if (Item) {
        const { name, gender, phone_num, email, address } = Item;
        res.json({ name, gender, phone_num, email, address });
      } else {
        res
          .status(404)
          .json({ error: 'Could not find contact with provided name' });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Could not retrieve contact" });
    }
  }
  
});

app.post("/contacts", async function (req, res) { // requirement #3 (CREATE) - create new contact
  const { name, gender, phone_num, email, address } = req.body;
  if (typeof name !== "string") {
    res.status(400).json({ error: 'Name must be a string' });
  } else if (typeof gender !== "string") {
    res.status(400).json({ error: 'Gender must be a string' });
  } else if (typeof phone_num !== "string") {
    res.status(400).json({ error: 'Phone number must be a string' });
  } else if (typeof email !== "string") {
    res.status(400).json({ error: 'Email must be a string' });
  } else if (typeof address !== "string") {
    res.status(400).json({ error: 'Address must be a string' });
  }

  const params = {
    TableName: CONTACTS_TABLE,
    Item: {
      name: name,
      gender: gender,
      phone_num: phone_num,
      email: email,
      address: address
    },
  };

  try {
    await dynamoDbClient.send(new PutCommand(params));
    res.json({ message: "Contact created" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not create contact" });
  }
});

const generateUpdateQuery = (fields) => {
  let exp = {
      UpdateExpression: 'set',
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {}
  }
  Object.entries(fields).forEach(([key, item]) => {
      exp.UpdateExpression += ` #${key} = :${key},`;
      exp.ExpressionAttributeNames[`#${key}`] = key;
      exp.ExpressionAttributeValues[`:${key}`] = item
  })
  exp.UpdateExpression = exp.UpdateExpression.slice(0, -1); 
  return exp
}

app.put("/contacts/:name", async function (req, res) { // #requirement #3 - update contact information
  let expression = generateUpdateQuery(req.body);

  const params = {
    TableName: CONTACTS_TABLE,
    Key: {
      name: req.params.name
    },
    ...expression
  };

  try {
    await dynamoDbClient.send(new UpdateCommand(params));
    res.json({ message: "Contact updated" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not update contact" });
  }
});

app.delete("/contacts/:name", async function (req, res) { // #requirement #3 (DELETE) - delete contact

  const params = {
    TableName: CONTACTS_TABLE,
    Key: {
      name: req.params.name
    }
  };

  try {
    await dynamoDbClient.send(new DeleteCommand(params));
    res.json({ message: "Contact deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not delete contact" });
  }
});

app.get("/contacts/gender/:gender", async function (req, res) { // requirement #7 - search for a specific gender
  const gender = req.params.gender;
  const params = {
    TableName: CONTACTS_TABLE,
    ExpressionAttributeNames: { "#gender": "gender" },
    FilterExpression: "#gender = :gender",
    ExpressionAttributeValues: {
      ":gender": gender
    },
  };

  try {
    const data = await dynamoDbClient.send(new ScanCommand(params));
    if (data.Items.length > 0) {
      var contacts = [];
      data.Items.forEach((contact) => {
        contacts.push(contact);
      });
      res.json({ contacts });
    } else {
      res.json({ message: "No contacts with specified gender found!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve contacts" });
  }
});

app.get("/contacts/email/:email", async function (req, res) { // requirement #6 - search for a specific email
  const email = req.params.email;
  const params = {
    TableName: CONTACTS_TABLE,
    ExpressionAttributeNames: { "#email": "email" },
    FilterExpression: "contains (#email, :email)",
    ExpressionAttributeValues: {
      ":email": email
    },
  };

  try {
    const data = await dynamoDbClient.send(new ScanCommand(params));
    if (data.Items.length > 0) {
      var contacts = [];
      data.Items.forEach((contact) => {
        contacts.push(contact);
      });
      res.json({ contacts });
    } else {
      res.json({ message: "No contacts with specified email found!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve contacts" });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
