FROM nginx:1.30-alpine
COPY index.html game.js art.js world.js day.png /usr/share/nginx/html/
EXPOSE 80
