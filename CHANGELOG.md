# Change Log

[unreleased]

### 1.0.4

**7-13-2019**

- Fixed npm reported security vulnerability (lodash).
- Added script to ensure npm modules are https.

### 1.0.3

**6-10-2019**

- Fixed npm reported security vulnerability.

### 1.0.2

**5-17-2019**

- Improved build process to use webpack as recommended by VSCode.

### 1.0.1

**5-17-2019**

- The authorization URL no longer worked because it was double encoded. (#48)

### 1.0.0

**4-6-2019**

- Added support for fetching a quoteModel and saving locally and running unit tests. (#42)
- Orgs were often listed as invalid and required re-authentication, even though the token refresh was successful. (#44)
- Removed example file for async/await because this was not transpiled correctly with the QCP transpiler.
- Added button icons to the editor navigation bar for the following use-cases:
  - To pull or push the active file that appear in the top right section of the tab bar of an active file.
  - To compare the active QCP file with the record from Salesforce.
  - To view the active QCP file in Salesforce.
- Added various [Octicons](https://octicons.github.com/) to commands. So far, the only icons visible are in the active editor navigation menu bar.
- Removed a number of commands that were confusing and focused on commands that work with the active file, as that is the most common use-case
  - Removed Commands:
    - `SFDC QCP: Pull specific QCP file from SFDC`
    - `SFDC QCP: Pull remote record from Salesforce`
    - `SFDC QCP: Push all files to Salesforce`
    - `SFDC QCP: Open QCP record from Salesforce`

### 0.5.0

**02-08-2019**

- Added ability to push active file. (#35)
- Updated version of vscode dependency. (#34)
- Added ability to view a file in Salesforce (requires re-initializing org before this will work). (#35)
- Added ability to view the transpiled JavaScript from a record in Salesforce Salesforce. (#37)
- Added ability to pull active files and overwrite local version. This was previously available, but required specifically selecting the file to pull. (#38)

### 0.4.0

**01-18-2019**

- When credentials were updated, the in-memory version was not updated if prior credentials were valid (#25)
- Updated login process to use OAuth instead of username+password (#4)
  - User is redirected to login page in web browser, and is redirected back to the application
  - Credentials are then stored locally using an access and refresh token
  - When the token expired, a new token us automatically obtained
  - Added encryption to credentials to avoid storing in plaintext
    - The generated encryption key is unique for each workspace
- Added logging output to the output console to allow users to keep track of session history (#29)
- When a file is deleted locally, a prompt is shown to provide the option to also delete from Salesforce.
- Pushing files on Windows did not work properly as `c:\` was added twice to path. (#32)

### 0.3.0

**12-19-2018**

- Open sourced project.
- Added license.
- Added repository information.

### 0.2.4

**12-16-2018**

- Fixed typo with login text input.

### 0.2.3

**12-16-2018**

- Fixed type error in example `qcp-example-true-end-date-and-sub-term.ts`.
- Fixed bug with invalid credentials with viewing unsaved records from Salesforce.
- Initialize project is the only shown menu option for projects that do not have the qcp configuration file in the workspace.
- Published [blog article](https://medium.com/@paustint/getting-started-with-the-salesforce-cpq-quote-calculator-plugin-vscode-extension-718306ff40d4).

### 0.2.2

**12-15-2018**

- Modified extension icon.

### 0.2.1

**12-15-2018**

- Added extension icon.
- Updated theme.
- Updated extension description.
- If a local file is created and pushed, and a record in Salesforce with the same name exists, that record will be used and overwritten.
- Added command to view record in Salesforce without pulling the record data to a local file.

### 0.2.0

**12-15-2018**

- Updated changelog file. (#9)
- Misc code cleanup.
- Pushing files now allows selecting multiple files instead of just one or all. (#3)
- When pulling files, a prompt with various actions is presented to the user before overwriting local records. (#15)
- Added a log file in the `.qcp` directory to show a history of what was pushed and pulled. (#14)
- Added ability to push files when they are saved, which includes a user confirmation. (#13)
- Updated background on the Marketplace. (#10)
- Updated extension display name to `Salesforce CPQ - Quote Calculator Plugin`. (#10)
- On initialize, if an org is already configured, then there is an option to skip re-initializing the org and just re-create any config files.
- Added prettier configuration file creation with project initialization. (#11)
- Added command to get diff from files or records.
- Added settings:
  - `sfdcQcp.pushOnSave` - When a file is saved, show prompt asking if file should be pushed to Salesforce.
  - `sfdcQcp.saveLog` - Determines if a log file should be saved each time a record from Salesforce is pushed or pulled.
  - `sfdcQcp.maxLogEntries` - Determines the maximum number of entries in the log file.
  - `sfdcQcp.prettier` - Determines if a .prettierrc file will be created on project initialization.
  - `prettierConfig` - Default [prettier configuration](https://prettier.io/docs/en/configuration.html) object. You must edit this configuration in JSON mode.

### 0.1.1

**12-09-2018**

- Added additional information on getting started. (#6)
- Fixed typo in README. (#7)

### 0.1.0

**12-08-2018**

- Initial release of the Plugin.
