@echo off
setlocal

if "%1"=="get" (
  if "%2"=="namespace" (
    echo {"kind":"Namespace","metadata":{"name":"%3"}}
    exit /b 0
  )
)

if "%1"=="create" (
  if "%2"=="namespace" (
    echo namespace/%3 created
    exit /b 0
  )
)

if "%1"=="apply" (
  echo job.batch/fake-job configured
  exit /b 0
)

echo ok
exit /b 0
