# Midnight Heist: build the APK

1. Create a free GitHub account and a new empty repository.
2. Upload everything in this folder, including the hidden .github folder.
   If your phone or browser skips .github, use Add file > Create new file
   and name it .github/workflows/build-apk.yml, then paste in the workflow file.
3. Open the repository's Actions tab. The "Build APK" run starts by itself (about 5 minutes).
4. Open the finished run, download the "midnight-heist-apk" artifact, unzip it and install app-debug.apk.
   Android will ask you to allow installs from your browser or file manager.

To change the game, edit www/index.html and push again.
