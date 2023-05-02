pushd "%DEPLOYMENT_TARGET%"
call :ExecuteCmd !NPM_CMD! run installMonkey
popd