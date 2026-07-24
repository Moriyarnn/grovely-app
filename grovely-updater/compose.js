function composeArgs (composeEnvFile, composeFiles, commandArgs) {
  return ['compose', '--env-file', composeEnvFile, ...composeFiles.flatMap(file => ['-f', file]), ...commandArgs]
}

module.exports = { composeArgs }
