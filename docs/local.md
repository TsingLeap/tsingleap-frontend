# 本地部署

首先需要配置本地host

``` bash
sudo nano /etc/hosts
```

在最后一行加入

```bash
127.0.0.1  local.app.spring25a.secoder.net
```

然后执行：

```bash
brew install mkcert
mkcert -install
mkcert local.app.spring25a.secoder.net
```

最后

```bash
npm run dev
```

访问

```
https://local.app.spring25a.secoder.net:5173/register
```

注意访问的时候不嫩挂梯子，不然上面的端口映射会出问题。