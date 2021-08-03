const jsforce = require("jsforce");

let sf_oper = {};

sf_oper._auth_token = undefined;
sf_oper._instanceUrl = undefined;

/**
 * Login into salesforce
 * @param {*} _loginUrl
 * @param {*} _clientId
 * @param {*} _clientSecret
 * @param {*} _username
 * @param {*} _password
 */
sf_oper.sflogin = async (
  _loginUrl,
  _clientId,
  _clientSecret,
  _username,
  _password
) => {
  let conn = new jsforce.Connection({
    oauth2: {
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: _loginUrl,
      clientId: _clientId,
      clientSecret: _clientSecret,
      redirectUri: "http://localhost",
    },
  });

  await conn.login(_username, _password);

  sf_oper._auth_token = conn.accessToken;
  sf_oper._instanceUrl = conn.instanceUrl;
};

sf_oper.getCase = async (_caseNo) => {
  if (!sf_oper._auth_token) {
    throw "access token is invalid";
  }

  let conn = new jsforce.Connection({
    instanceUrl: sf_oper._instanceUrl,
    accessToken: sf_oper._auth_token,
  });

  let record = [];

  const s_casenumber = _caseNo + "%";
  let result = await conn
    .sobject("Case")
    .find(
      {
        CaseNumber: { $like: s_casenumber },
      },
      {
        Id: 1,
        CaseNumber: 1,
        Subject: 1,
        Status: 1,
        CreatedDate: 1
      }
    )
    .limit(5)
    .execute((err, records) => {
      if (err) {
        return console.error(err);
      }

      return records;
    });

  return result;
};

sf_oper.closeCase = async (_caseId) => {
  if (!sf_oper._auth_token) {
    throw "access token is invalid";
  }

  let conn = new jsforce.Connection({
    instanceUrl: sf_oper._instanceUrl,
    accessToken: sf_oper._auth_token,
  });

  let res = false;
  await conn.sobject("Case").update(
    {
      Id: _caseId,
      Status: "Closed",
    },
    function (err, rets) {
      res = rets.success;
    }
  );

  return res;
};

sf_oper.addCaseComment = async (_caseNo, _comment) => {
  if (!sf_oper._auth_token) {
    throw "access token is invalid";
  }

  let conn = new jsforce.Connection({
    instanceUrl: sf_oper._instanceUrl,
    accessToken: sf_oper._auth_token,
  });

  let result = await conn
    .sobject("Case")
    .find(
      { CaseNumber: _caseNo },
      {
        Id: 1,
        CaseNumber: 1,
      }
    )
    .limit(1)
    .execute((err, records) => {
      if (err) {
        return console.error(err);
      }

      return records;
    });

  
  //create a case comment
  return await conn
    .sobject("CaseComment")
    .create({ ParentId: result[0].Id, CommentBody: _comment, IsPublished: true }, (err, ret) => {
      if (err || !ret.success) {
        console.log(err);
        return false;
      }
      return true;
    });
};

sf_oper.getCaseDetailsById = async (_caseId) => {
  if (!sf_oper._auth_token) {
    throw "access token is invalid";
  }

  let conn = new jsforce.Connection({
    instanceUrl: sf_oper._instanceUrl,
    accessToken: sf_oper._auth_token,
  });

  let record = [];
  
  let result = await conn
    .sobject("Case")
    .find(
      {
        Id: _caseId,
      },
      {
        Id: 1,
        CaseNumber: 1,
        Subject: 1,
        Status: 1,
        CreatedDate: 1,
        Description: 1
      }
    )
    .limit(1)
    .execute((err, records) => {
      if (err) {
        return console.error(err);
      }

      return records;
    });

  return result;
};

sf_oper.getCasesByOwner = async (_ownerId) => {
  if (!sf_oper._auth_token) {
    throw "access token is invalid";
  }

  let conn = new jsforce.Connection({
    instanceUrl: sf_oper._instanceUrl,
    accessToken: sf_oper._auth_token,
  });

  let record = [];
  
  let result = await conn
    .sobject("Case")
    .find(
      {
        OwnerId: _ownerId
      },
      {
        Id: 1,
        CaseNumber: 1,
        Subject: 1,
        Status: 1,
        CreatedDate: 1
      }
    )
    .sort({CreatedDate: -1})
    .limit(5)
    .execute((err, records) => {
      if (err) {
        return console.error(err);
      }

      return records;
    });

  return result;
};

module.exports = sf_oper;
