# 第一阶段：构建 React/Vite 项目
FROM m.daocloud.io/docker.io/library/node:18 as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 第二阶段：用 nginx 运行静态页面
FROM m.daocloud.io/docker.io/library/nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY ./Nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]