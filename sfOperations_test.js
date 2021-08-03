if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

let sf_test = require('./sfOperations.js');

sf_test.sflogin(process.env.SF_LOGIN_URL, process.env.CLIENT_ID, process.env.CLIENT_SECRET,
    process.env.USER_NAME, process.env.PASS)
    .then(() => {
        console.log('Access Token => ' + sf_test._auth_token);
        // get Case
        sf_test.getCase('00001000').then((res)=> {console.log(res);});
        
    });

//sf_test.getCase()