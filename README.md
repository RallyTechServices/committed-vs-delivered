# Committed vs Delivered

Show User Stories or Portfolio Items committed and delivered in a timebox.

For each timebox in the current project show the number of artifacts where:
* timebox planning period - the timebox start date plus a configurable number of days (default 2)
* committed - artifact was assigned to the timebox before the timebox end and remained assigned after the planning period end
* delivered - committed artifact was accepted (or actual end date) before timebox end
* planned - committed artifact was assigned to the timebox before the planning period ended
* unplanned - committed artifact was assigned to the timebox after the planning period ended

Other features:
* Advanced filter for artifact
* Data export as CSV
* Configurable data attributes for export, but always includes:
  * `FormattedID`
  * `Name`,
  * `AcceptedDate` (or `ActualEndDate`)
  * `TimeboxName`
  * `TimeboxStartDate`
  * `TimeboxEndDate`
  * `TimeboxAddedDate`
  * `Planned`
  * `Delivered`
* Configurable:
  * By `User Story` or lowest level portfolio item (e.g. `Feature`)
  * By `Release` or `Iteration` timebox type
  * Number of timeboxes to look back
  * Days after timebox start that and item can be added to an timebox and still be considered "Planned"
  * Show the current (in-progress) timebox.

## Caveats
* Artifacts are only shown in timeboxes that start *before* the artifact accepted date.
Accepting a story today, means the work finished in today’s timebox. If the accepted story
is then assigned to a timebox starting next week...the work didn’t move to next week,
it still finished today. It isn't considered committed to that subsequent timebox because there
is nothing left to accept.
* The chart only shows artifacts that *currently* exist. Artifacts that have been deleted are
not shown.
* Applied to current project or below.

![screenshot](screenshot.png "Screenshot")

## Development Notes

### First Load

If you've just downloaded this from github and you want to do development,
you're going to need to have these installed:

 * node.js
 * grunt-cli
 * grunt-init

Since you're getting this from github, we assume you have the command line
version of git also installed.  If not, go get git.

If you have those three installed, just type this in the root directory here
to get set up to develop:

  npm install

### Structure

  * src/javascript:  All the JS files saved here will be compiled into the
  target html file
  * src/style: All of the stylesheets saved here will be compiled into the
  target html file
  * test/fast: Fast jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts
  (fastHelper.js) **Tests should be in a file named <something>-spec.js**
  * test/slow: Slow jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts
  (slowHelper.js) **Tests should be in a file named <something>-spec.js**
  * templates: This is where templates that are used to create the production
  and debug html files live.  The advantage of using these templates is that
  you can configure the behavior of the html around the JS.
  * config.json: This file contains the configuration settings necessary to
  create the debug and production html files.  Server is only used for debug,
  name, className and sdk are used for both.
  * package.json: This file lists the dependencies for grunt
  * auth.json: This file should NOT be checked in.  Create this to run the
  slow test specs.  It should look like:
    {
        "username":"you@company.com",
        "password":"secret"
    }

### Usage of the grunt file
####Tasks

##### grunt debug

Use grunt debug to create the debug html file.  You only need to run this when you have added new files to
the src directories.

##### grunt build

Use grunt build to create the production html file.  We still have to copy the html file to a panel to test.

##### grunt test-fast

Use grunt test-fast to run the Jasmine tests in the fast directory.  Typically, the tests in the fast
directory are more pure unit tests and do not need to connect to Rally.

##### grunt test-slow

Use grunt test-slow to run the Jasmine tests in the slow directory.  Typically, the tests in the slow
directory are more like integration tests in that they require connecting to Rally and interacting with
data.

##### grunt deploy

Use grunt deploy to build the deploy file and then install it into a new page/app in Rally.  It will create the page on the Home tab and then add a custom html app to the page.  The page will be named using the "name" key in the config.json file (with an asterisk prepended).

You can use the makeauth task to create this file OR construct it by hand.  Caution: the
makeauth task will delete this file.

The auth.json file must contain the following keys:
{
    "username": "fred@fred.com",
    "password": "fredfredfred",
    "server": "https://us1.rallydev.com"
}

(Use your username and password, of course.)  NOTE: not sure why yet, but this task does not work against the demo environments.  Also, .gitignore is configured so that this file does not get committed.  Do not commit this file with a password in it!

When the first install is complete, the script will add the ObjectIDs of the page and panel to the auth.json file, so that it looks like this:

{
    "username": "fred@fred.com",
    "password": "fredfredfred",
    "server": "https://us1.rallydev.com",
    "pageOid": "5233218186",
    "panelOid": 5233218188
}

On subsequent installs, the script will write to this same page/app. Remove the
pageOid and panelOid lines to install in a new place.  CAUTION:  Currently, error checking is not enabled, so it will fail silently.

##### grunt watch

Run this to watch files (js and css).  When a file is saved, the task will automatically build, run fast tests, and deploy as shown in the deploy section above.

##### grunt makeauth

This task will create an auth.json file in the proper format for you.  **Be careful** this will delete any existing auth.json file.  See **grunt deploy** to see the contents and use of this file.

##### grunt --help  

Get a full listing of available targets.
