module.exports = function (app, passport, expressValidator, connection, isLoggedIn, sendMail) {

    var multer  = require('multer');

    // Multipart form data handling
    var storage = multer.diskStorage({
            fileFilter: function (req, file, cb) {

                if (file.mimetype !== 'image/png') {
          req.fileValidationError = 'goes wrong on the mimetype';
          return cb(null, false, new Error('goes wrong on the mimetype'));
         }
         cb(null, true);
     },
      destination: function (req, file, cb) {
        cb(null,  __dirname + '/../uploads/screenshots')
      },
      filename: function (req, file, cb) {
        var filename = file.originalname;
        filename = filename.split(".")[0] + Date.now() + "." + filename.split(".")[1];
        req.body.filename = filename;
        cb(null, filename);
        // var extension = filename.split(".")[1];
        // if(extension == 'jpg' || extension == 'png' || extension == 'jpeg') {
        //     req.body.filename = filename;
        //     cb(null, filename);
        // }
        // else {
        //     cb(null,null);
        // }
        }
    });
    var upload = multer({ storage: storage });

    // Get list of projects in which tester is present in the team
    app.get('/tester/testerTasks', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            var projects;
            connection.query("SELECT DISTINCT(projects.id) AS projectId, projects.name AS projectName, projects.manager_id AS managerId, users.name AS managerName  FROM project_team JOIN projects JOIN users ON project_team.project_id = projects.id AND projects.manager_id = users.id WHERE project_team.user_id = ? AND projects.status = 'Open'", [req.user.id], function(err, tasksRes) {
                if (err)
                    throw (err);
                else {
                    console.log(tasksRes);
                    res.render('testerBugReports.ejs', {
                        user: req.user,
                        type: "tasks",
                        resultTes: tasksRes
                    });
                }
            });
        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Display report bug form. Also get list of projects the tester is present in.
    app.get('/tester/reportBug', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            var projects;
            connection.query("SELECT * FROM project_team JOIN users JOIN projects ON users.id = project_team.user_id AND project_team.project_id = projects.id WHERE users.id = ? AND projects.status = 'Open'", [req.user.id], function(err, rows) {
                if (err)
                    throw (err);
                else {
                    console.log(rows);
                    res.render('reportBug.ejs', {
                        user: req.user,
                        proj: rows,
                        len: rows.length
                    });
                }
            });
        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Insert bug details into the Database
    app.post('/tester/reportBug', isLoggedIn, upload.single('screenshots'), function(req, res) {

        if (req.user.class == 1) {

           var date = new Date();
           var year = date.getFullYear();
           var month = date.getMonth();
           var day = date.getDate();
           var today = year + "-" + (month + 1) + "-" + day;
          if(req.body.filename) {
            var message;
            var extension = req.body.filename.split(".")[1];
            console.log("\nExtension : ", extension);
            req.body.ext = extension;
            req.assert('bug_name', 'Bug name is required').notEmpty().isLength(5, 50);
            req.assert('bug_type', 'Bug type is required').notEmpty().isIn(['Type A', 'Type B', 'Type C']);
            req.assert('project', 'Project ID is required').notEmpty().isNumeric();
            req.assert('bug_description', 'Bug Description is required').notEmpty().isLength(50, 500);
            req.assert('severity', 'Severity is required').notEmpty().isIn(['Major', 'Minor', 'Critical']);
            req.assert('file', 'File is required').notEmpty();
            req.assert('method', 'Method is required').notEmpty();
            req.assert('priority', 'Priority is required').notEmpty().isIn(['Low', 'Moderate', 'High']);
            req.assert('line', 'Line number is required').notEmpty().isNumeric();
            req.assert('filename', 'Filename is required').notEmpty();
            req.assert('ext', 'Extension').notEmpty().isIn(['jpg', 'png', 'jpeg']);

            var errors = req.validationErrors();
            if (!errors) { //No errors were found.  Passed Validation!
                function reportBug() {
                    return new Promise(function(resolve, reject) {
                        var dbQuery = "INSERT INTO `bug_tracker`.`bugs` (`id`, `name`, `bug_type`, `description`, `project_id`, `file`, `method`, `line`, `priority`, `severity`, `status`, `tester_id`, `developer_id`, `screenshot`, `date`) VALUES (NULL, \"" + req.body.bug_name + "\", \"" + req.body.bug_type + "\", \"" + req.body.bug_description + "\", \"" + req.body.project + "\", \"" + req.body.file + "\", \"" + req.body.method + "\", \"" + req.body.line + "\", \"" + req.body.priority + "\", \"" + req.body.severity + "\", \"Open\", \"" + req.user.id + "\" , NULL, \""+ req.body.filename +"\", \""+today+"\")";

                        connection.query(dbQuery, function(err, rows) {
                            if (err)
                                reject(err);
                            else {
                                connection.query("SELECT * FROM project_team JOIN users JOIN projects ON users.id = project_team.user_id AND project_team.project_id = projects.id WHERE users.id = ? AND projects.status = 'Open'", [req.user.id], function(err, rows) {
                                    if (err)
                                        throw (err);
                                    else {
                                        console.log("Bug report successful");
                                        message = "success";
                                        res.render('reportBug.ejs', {
                                            user: req.user,
                                            msg: message,
                                            proj: rows,
                                            len: rows.length
                                        });
                                        resolve([req.body.project, req.body.bug_name, req.body.bug_type, req.body.bug_description, req.body.priority, req.body.severity, req.user.id]);
                                    }
                                });
                            }
                        });
                    });
                }
                reportBug().then(function(params) {
                    var projectId = params[0];
                    var bugName = params[1];
                    var bugType = params[2];
                    var description = params[3];
                    var priority = params[4];
                    var severity = params[5];
                    var testerId = params[6];
                    var dbQuery = "SELECT users.name AS managerName, projects.name AS projectName, users.email AS email FROM users JOIN projects ON projects.manager_id = users.id AND projects.id = ?"
                    connection.query(dbQuery, [params[0]], function(err, rows) {
                        if (err)
                            console.log(err);
                        else {
                            rows.forEach(function(item, index) {
                                var toAddress = item.email;
                                var subject = "New bug reported!"
                                var text = "Dear "+item.managerName+",\n\nA new bug has been reported in a project that you manage :\n\nProject : "+ item.projectName +"\n\nBug name : "+bugName+"\nBug type : "+bugType+"\nDescription : "+description+"\nSeverity : "+severity+"\nPriority : "+priority+"\nTester ID : "+testerId;
                                return sendMail(toAddress, subject, text);
                            });
                        }
                    });
                }).then(function(response) {
                    console.log(response);
                }).catch(function(err) {
                    console.log(err);
                });
            } else { //Display errors to user
                console.log("Bug report failed");
                console.log(errors);
                message = "error";
                res.render('reportBug.ejs', {
                    user: req.user,
                    msg: message
                });
            }
          }
          else {
            var message;
            req.assert('bug_name', 'Bug name is required').notEmpty().isLength(5, 50);
            req.assert('bug_type', 'Bug type is required').notEmpty().isIn(['Type A', 'Type B', 'Type C']);
            req.assert('project', 'Project ID is required').notEmpty().isNumeric();
            req.assert('bug_description', 'Bug Description is required').notEmpty().isLength(50, 500);
            req.assert('severity', 'Severity is required').notEmpty().isIn(['Major', 'Minor', 'Critical']);
            req.assert('file', 'File is required').notEmpty();
            req.assert('method', 'Method is required').notEmpty();
            req.assert('priority', 'Priority is required').notEmpty().isIn(['Low', 'Moderate', 'High']);
            req.assert('line', 'Line number is required').notEmpty().isNumeric();

            var errors = req.validationErrors();
            if (!errors) { //No errors were found.  Passed Validation!
                function reportBug() {
                    return new Promise(function(resolve, reject) {
                        var dbQuery = "INSERT INTO `bug_tracker`.`bugs` (`id`, `name`, `bug_type`, `description`, `project_id`, `file`, `method`, `line`, `priority`, `severity`, `status`, `tester_id`, `developer_id`, `date`) VALUES (NULL, \"" + req.body.bug_name + "\", \"" + req.body.bug_type + "\", \"" + req.body.bug_description + "\", \"" + req.body.project + "\", \"" + req.body.file + "\", \"" + req.body.method + "\", \"" + req.body.line + "\", \"" + req.body.priority + "\", \"" + req.body.severity + "\", \"Open\", \"" + req.user.id + "\" , NULL, \""+ today +"\")";

                        connection.query(dbQuery, function(err, rows) {
                            if (err)
                                reject(err);
                            else {
                                connection.query("SELECT * FROM project_team JOIN users JOIN projects ON users.id = project_team.user_id AND project_team.project_id = projects.id WHERE users.id = ? AND projects.status = 'Open'", [req.user.id], function(err, rows) {
                                    if (err)
                                        throw (err);
                                    else {
                                        console.log("Bug report successful");
                                        message = "success";
                                        res.render('reportBug.ejs', {
                                            user: req.user,
                                            msg: message,
                                            proj: rows,
                                            len: rows.length
                                        });
                                        resolve([req.body.project, req.body.bug_name, req.body.bug_type, req.body.bug_description, req.body.priority, req.body.severity, req.user.id]);
                                    }
                                });
                            }
                        });
                    });
                }
                reportBug().then(function(params) {
                    var projectId = params[0];
                    var bugName = params[1];
                    var bugType = params[2];
                    var description = params[3];
                    var priority = params[4];
                    var severity = params[5];
                    var testerId = params[6];
                    var dbQuery = "SELECT users.name AS managerName, projects.name AS projectName, users.email AS email FROM users JOIN projects ON projects.manager_id = users.id AND projects.id = ?"
                    connection.query(dbQuery, [params[0]], function(err, rows) {
                        if (err)
                            console.log(err);
                        else {
                            rows.forEach(function(item, index) {
                                var toAddress = item.email;
                                var subject = "New bug reported!"
                                var text = "Dear "+item.managerName+",\n\nA new bug has been reported in a project that you manage :\n\nProject : "+ item.projectName +"\n\nBug name : "+bugName+"\nBug type : "+bugType+"\nDescription : "+description+"\nSeverity : "+severity+"\nPriority : "+priority+"\nTester ID : "+testerId;
                                return sendMail(toAddress, subject, text);
                            });
                        }
                    });
                }).then(function(response) {
                    console.log(response);
                }).catch(function(err) {
                    console.log(err);
                });
            } else { //Display errors to user
                console.log("Bug report failed");
                console.log(errors);
                message = "error";
                res.render('reportBug.ejs', {
                    user: req.user,
                    msg: message
                });
            }
          }

        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }

    });

    // Get list of bugs pending tester review
    app.get('/tester/reviewBugs', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            connection.query("SELECT bugs.id AS bugID, bugs.name AS bugName, bugs.bug_type AS bugType, bugs.description AS description, bugs.severity AS severity, bugs.priority AS priority, bugs.file AS file, bugs.method AS method, bugs.line AS line, bugs.status AS status, bugs.developer_id AS assignedTo, projects.name AS projectName, users.name AS assignedToName FROM bugs JOIN projects JOIN users ON bugs.project_id = projects.id AND projects.status = 'Open' AND tester_id = ? AND bugs.status = 'Review' AND bugs.developer_id = users.id ORDER BY bugs.id DESC", [req.user.id], function(err, bugsRes) {
                if (err)
                    console.log(err);
                else {
                    res.render('testerBugReports.ejs', {
                        user: req.user,
                        type: "review",
                        resultTes: bugsRes
                    });
                }
            });
        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Update database with new staus of the bugs after review
    app.post('/tester/reviewBugs', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            if(typeof(req.body.reason) != 'undefined') {
              req.assert('status').notEmpty().isIn(['Review Reject', 'Approval']);
              req.assert('bug').notEmpty().isInt();
              req.assert('reason').notEmpty();
              var errors = req.validationErrors();
              if (!errors) {
                  function updateBugStatusTester() {
                      return new Promise(function(resolve, reject) {
                        var dbQuery = "UPDATE bugs SET status = ?, reject_reason = ? WHERE id = ?";
                        connection.query(dbQuery, [req.body.status, req.body.reason, req.body.bug], function(err, devRes) {
                              if (err)
                                  reject(err);
                              else {
                                  // console.log("Database update successful");
                                  resolve([req.body.status, req.body.bug]);
                              }
                          });
                      });
                  }
                  updateBugStatusTester().then(function(params) {
                    return new Promise(function(resolve, reject) {
                      var status = params[0];
                      var bugId = params[1];
                      var dbQuery = "SELECT * FROM projects JOIN bugs WHERE bugs.id = ? AND bugs.project_id = projects.id";
                      connection.query(dbQuery, [bugId], function(err, bugsRes) {
                          if (err)
                              reject(err);
                          else {
                              resolve(bugsRes);
                          }
                      });
                    });
                  }).then(function(bugsRes) {
                    return new Promise(function(resolve, reject) {
                      var dbQuery = "SELECT * FROM users WHERE id IN("+bugsRes[0].developer_id+", "+bugsRes[0].manager_id+")";
                      connection.query(dbQuery, function(err, usersRes) {
                          if (err)
                              reject(err);
                          else {
                              resolve([bugsRes, usersRes]);
                          }
                      });
                    });
                  }).then(function(params) {
                    var bugsRes = params[0];
                    console.log("Params :\n");
                    console.log(params[0]);
                    console.log("Bugs :\n");
                    console.log(bugsRes);
                    var usersRes = params[1];
                    usersRes.forEach(function(item, index) {
                      var toAddress = item.email;
                      var subject = "Bug status changed!"
                      var text = "Dear "+item.name+",\n\nThe status of a bug that you are involved in has been changed recently :\n\nBug ID : "+bugsRes[0].id+"\n\nBug name : "+bugsRes[0].name+"\nBug type : "+bugsRes[0].bug_type+"\nDescription : "+bugsRes[0].description+"\nSeverity : "+bugsRes[0].severity+"\nPriority : "+bugsRes[0].priority+"\nStatus : "+bugsRes[0].status+"\nReject Reason : "+bugsRes[0].reject_reason;
                      return sendMail(toAddress, subject, text);
                    });
                  }).then(function(response) {
                    console.log(response);
                    res.send("Bug status changed successfully.")
                  }).catch(function(err) {
                    console.log(err);
                });
              } else {
                  console.log("Invalid input1");
                  res.end("Invalid input1");
              }
            }
            else {
              req.assert('status').notEmpty().isIn(['Review Reject', 'Approval']);
              req.assert('bug').notEmpty().isInt();
              var errors = req.validationErrors();
              if (!errors) {
                  function updateBugStatusTester() {
                      return new Promise(function(resolve, reject) {
                        var dbQuery = "UPDATE bugs SET status = ? WHERE id = ?";
                        connection.query(dbQuery, [req.body.status, req.body.bug], function(err, devRes) {
                              if (err)
                                  reject(err);
                              else {
                                  // console.log("Database update successful");
                                  resolve([req.body.status, req.body.bug]);
                              }
                          });
                      });
                  }
                  updateBugStatusTester().then(function(params) {
                    return new Promise(function(resolve, reject) {
                      var status = params[0];
                      var bugId = params[1];
                      var dbQuery = "SELECT * FROM projects JOIN bugs WHERE bugs.id = ? AND bugs.project_id = projects.id";
                      connection.query(dbQuery, [bugId], function(err, bugsRes) {
                          if (err)
                              reject(err);
                          else {
                              resolve(bugsRes);
                          }
                      });
                    });
                  }).then(function(bugsRes) {
                    return new Promise(function(resolve, reject) {
                      var dbQuery = "SELECT * FROM users WHERE id IN("+bugsRes[0].developer_id+", "+bugsRes[0].manager_id+")";
                      connection.query(dbQuery, function(err, usersRes) {
                          if (err)
                              reject(err);
                          else {
                              resolve([bugsRes, usersRes]);
                          }
                      });
                    });
                  }).then(function(params) {
                    var bugsRes = params[0];
                    console.log("Params :\n");
                    console.log(params[0]);
                    console.log("Bugs :\n");
                    console.log(bugsRes);
                    var usersRes = params[1];
                    usersRes.forEach(function(item, index) {
                      var toAddress = item.email;
                      var subject = "Bug status changed!"
                      var text = "Dear "+item.name+",\n\nThe status of a bug that you are involved in has been changed recently :\n\nBug ID : "+bugsRes[0].id+"\n\nBug name : "+bugsRes[0].name+"\nBug type : "+bugsRes[0].bug_type+"\nDescription : "+bugsRes[0].description+"\nSeverity : "+bugsRes[0].severity+"\nPriority : "+bugsRes[0].priority+"\nStatus : "+bugsRes[0].status;
                      return sendMail(toAddress, subject, text);
                    });
                  }).then(function(response) {
                    console.log(response);
                    res.send("Bug status changed successfully.")
                  }).catch(function(err) {
                    console.log(err);
                });
              } else {
                  console.log("Invalid input2");
                  res.end("Invalid input2");
              }
            }
        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Get list of bugs that were reported by the tester
    app.get('/tester/trackBugs', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            connection.query("SELECT bugs.id AS bugID, bugs.name AS bugName, bugs.bug_type AS bugType, bugs.description AS description, bugs.severity AS severity, bugs.priority AS priority, bugs.file AS file, bugs.method AS method, bugs.line AS line, bugs.status AS status, bugs.developer_id AS assignedTo, projects.name AS projectName FROM bugs JOIN projects ON bugs.project_id = projects.id AND projects.status = 'Open' AND tester_id = ? AND bugs.status NOT IN ('Review') ORDER BY bugs.id DESC", [req.user.id], function(err, bugsRes) {
                if (err)
                    console.log(err);
                else {
                    res.render('testerBugReports.ejs', {
                        user: req.user,
                        type: "track",
                        resultTes: bugsRes
                    });
                }
            });
        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Edit details of a bug reported by the tester
    app.get('/tester/reportBug/editBugDetails/:params', isLoggedIn, function(req, res) {
        if (req.user.class == 1) {
            getProjectsTester(req).then(function(projRes) {
                return getBugDetails(req, projRes);
            }).then(function(params) {
              if(params[1].length != 0) { // If bug exists
                if(params[1][0].tester_id != req.user.id) {
                  res.end("Forbidden acces");
                }
                else {
                  res.render('editBugDetails.ejs', {
                      user: req.user,
                      proj: params[0],
                      len: params[0].length,
                      bugs: params[1]
                  });
                }
              }
              else {
                res.end("Invalid Bug ID");
              }
            }).catch(function(err) {
                console.log(err);
            });
        }
        else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }
    });

    // Update the database with the edited bug details
    app.post('/tester/reportBug/editBugDetails/', isLoggedIn, upload.single('screenshots'), function(req, res) {

        if (req.user.class == 1) {

          if(req.body.filename) {
            getProjectsTester(req).then(function(projRes) {
                return getBugsEdit(req, projRes);
            }).then(function(params) {

                var message;
                var extension = req.body.filename.split(".")[1];
                console.log("\nExtension : ", extension);
                req.body.ext = extension;
                req.assert('bug_name', 'Bug name is required').notEmpty().isLength(5, 50);
                req.assert('bug_type', 'Bug type is required').notEmpty().isIn(['Type A', 'Type B', 'Type C']);
                req.assert('project', 'Project ID is required').notEmpty().isNumeric();
                req.assert('bug_description', 'Bug Description is required').notEmpty().isLength(50, 500);
                req.assert('severity', 'Severity is required').notEmpty().isIn(['Major', 'Minor', 'Critical']);
                req.assert('file', 'File is required').notEmpty();
                req.assert('method', 'Method is required').notEmpty();
                req.assert('priority', 'Priority is required').notEmpty().isIn(['Low', 'Moderate', 'High']);
                req.assert('line', 'Line number is required').notEmpty().isNumeric();
                req.assert('filename', 'Filename is required').notEmpty();
                req.assert('ext', 'Extension').notEmpty().isIn(['jpg', 'png', 'jpeg']);

                var errors = req.validationErrors();
                if (!errors) { //No errors were found.  Passed Validation!
                    console.log("Before query");
                    var dbQuery = "UPDATE bugs SET name = ?, bug_type = ?, project_id = ?, description = ?, file = ?, method = ?, line = ?, severity = ?, priority = ?, screenshot = ? WHERE bugs.id = ?";

                    connection.query(dbQuery, [req.body.bug_name, req.body.bug_type, req.body.project, req.body.bug_description, req.body.file, req.body.method, req.body.line, req.body.severity, req.body.priority, req.body.filename, req.body.bug_id] , function(err, rows) {
                        if (err)
                            throw (err);
                        else {
                            console.log("Bug edit successful");
                            message = "success";
                            res.render('editBugDetails.ejs', {
                                user: req.user,
                                msg: message,
                                proj: params[0],
                                len: params[0].length,
                                bugs: params[1]
                            });
                        }
                    });
                } else { //Display errors to user
                    console.log("Bug edit failed");
                    console.log(errors);
                    message = "error";
                    res.render('editBugDetails.ejs', {
                        user: req.user,
                        msg: message,
                        proj: params[0],
                        len: params[0].length,
                        bugs: params[1]
                    });
                }
            }).catch(function(err) {
                console.log(err);
            });
          }
          else {
            getProjectsTester(req).then(function(projRes) {
                return getBugsEdit(req, projRes);
            }).then(function(params) {

                var message;
                req.assert('bug_name', 'Bug name is required').notEmpty().isLength(5, 50);
                req.assert('bug_type', 'Bug type is required').notEmpty().isIn(['Type A', 'Type B', 'Type C']);
                req.assert('project', 'Project ID is required').notEmpty().isNumeric();
                req.assert('bug_description', 'Bug Description is required').notEmpty().isLength(50, 500);
                req.assert('severity', 'Severity is required').notEmpty().isIn(['Major', 'Minor', 'Critical']);
                req.assert('file', 'File is required').notEmpty();
                req.assert('method', 'Method is required').notEmpty();
                req.assert('priority', 'Priority is required').notEmpty().isIn(['Low', 'Moderate', 'High']);
                req.assert('line', 'Line number is required').notEmpty().isNumeric();

                var errors = req.validationErrors();
                if (!errors) { //No errors were found.  Passed Validation!
                    console.log("Before query");
                    var dbQuery = "UPDATE bugs SET name = ?, bug_type = ?, project_id = ?, description = ?, file = ?, method = ?, line = ?, severity = ?, priority = ? WHERE bugs.id = ?";

                    connection.query(dbQuery, [req.body.bug_name, req.body.bug_type, req.body.project, req.body.bug_description, req.body.file, req.body.method, req.body.line, req.body.severity, req.body.priority, req.body.bug_id] , function(err, rows) {
                        if (err)
                            throw (err);
                        else {
                            console.log("Bug edit successful");
                            message = "success";
                            res.render('editBugDetails.ejs', {
                                user: req.user,
                                msg: message,
                                proj: params[0],
                                len: params[0].length,
                                bugs: params[1]
                            });
                        }
                    });
                } else { //Display errors to user
                    console.log("Bug edit failed");
                    console.log(errors);
                    message = "error";
                    res.render('editBugDetails.ejs', {
                        user: req.user,
                        msg: message,
                        proj: params[0],
                        len: params[0].length,
                        bugs: params[1]
                    });
                }
            }).catch(function(err) {
                console.log(err);
            });
          }

        } else {
            console.log("Forbidden access");
            res.end("Forbidden access");
        }

    });

    // Get list of projects in which the tester is present
    function getProjectsTester(req) {
				return new Promise(function(resolve, reject) {
					connection.query("SELECT * FROM project_team JOIN users JOIN projects ON users.id = project_team.user_id AND project_team.project_id = projects.id WHERE users.id = ? AND projects.status = 'Open'", [req.user.id], function(err, projRes) {
						if (err)
							reject(err);
						else {
							console.log("Projects obtained\n");
							resolve(projRes);
						}
					});
				});
	}

  // Get complete details of a bug
	function getBugDetails(req, projRes) { // Get complete details of the bug
		return new Promise(function(resolve, reject) {
			connection.query("SELECT * FROM bugs WHERE bugs.id = ?", [req.params.params], function(err, bugsRes) {
				if (err)
					reject(err);
				else {
					console.log("Bugs obtained\n");
					resolve([projRes, bugsRes]);
				}
			});
		});
	}

  // Get the details of the bug to be edited
	function getBugsEdit(req, projRes) {
		return new Promise(function(resolve, reject) {
			connection.query("SELECT * FROM bugs WHERE bugs.id = ?", [req.body.bug_id], function(err, bugsRes) {
				if (err)
					reject(err);
				else {
					console.log("Bugs obtained\n");
					resolve([projRes, bugsRes]);
				}
			});
		});
	}

};
