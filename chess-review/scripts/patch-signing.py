import os,re
p='android/app/build.gradle'
s=open(p).read()
block='''android {
    signingConfigs {
        debug {
            storeFile file("../rookwise.p12")
            storePassword "rookwise"
            keyAlias "rookwise"
            keyPassword "rookwise"
            storeType "pkcs12"
        }
    }
'''
assert 'signingConfigs' not in s
s=s.replace('android {\n',block,1)
vc=os.environ.get('GITHUB_RUN_NUMBER','1')
s,n=re.subn(r'versionCode\s+\d+','versionCode '+vc,s,1)
assert n==1,'versionCode not found'
open(p,'w').write(s)
print('patched signing + versionCode',vc)
