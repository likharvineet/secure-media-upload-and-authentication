# import type

- we will use moduleJS type to import files and packages insted to commonJS.

# About public/temp

- in this folder we will store files temperorily, so that if there is any problem with our cloud service while uploading the file, we still can access the file.

# Dir Structure

- .env : to keep all envirnment variables
- .prettierrc : contains prettier config
- .prettierignore : contains list of files which we don't want to get formatted
- /src : dir where we will keep our all files
  - index.js
  - app.js
  - constants.js
  - /controllers : it contains all the functionality
  - /db : contains db connection config
  - /middlewares : code to run inbetween req and res. like validations
  - /models : contains db models
  - /routes : contains all the api routes
  - /utils : contains utilities (functionalities) which will be used more then one time. like uploading files, handling email,

as connectDB() is a async function, it returns a promise. we use this promise in ./src/index.js for then() and catch()
