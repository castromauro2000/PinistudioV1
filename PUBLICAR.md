# 📤 Cómo compartir PiniStudio con tus amigos

Hay **tres formas**. De la más rápida a la más "profesional":

---

## 🥇 Opción 1 — Link público (la mejor para compartir de verdad)

### Subirlo a Netlify Drop (5 minutos, gratis, sin código)

1. Entrá a **<https://app.netlify.com/drop>** y creá una cuenta (o entrá con Google/GitHub).
2. **Arrastrá la carpeta `publicar/`** (la que está en este proyecto) a la página.
3. En 10 segundos te da un link tipo:
   ```
   https://alejandro-pinistudio.netlify.app
   ```
4. Ese link es el que mandás por WhatsApp. **Cada quien tiene sus propios datos**
   y puede bajarse su propia copia con el botón ⬇️ de la app.

> **¿Por qué `publicar/` y no la carpeta entera?** Netlify publicaría también los
> scripts de desarrollo (empaquetar.ps1, servidor.ps1, LECCIONES/...). La carpeta
> `publicar/` tiene solo lo necesario: `index.html`, `styles.css`, `app.js` y `sw.js`.

### Ventajas de publicarlo en https
- Funciona desde el **celular** (es un link, no un archivo).
- **Las notificaciones push funcionan** (https = "contexto seguro").
- Se puede compartir en cualquier momento, sin que tu compu esté encendida.

### Alternativa: GitHub Pages (si ya tenés GitHub)
```powershell
git init
git add publicar/
git commit -m "PiniStudio"
git branch -M main
git remote add origin https://github.com/TUUSUARIO/pinistudio.git
git push -u origin main
```
 Después: **Settings → Pages → Source: main / root** → te da `https://TUUSUARIO.github.io/pinistudio/`.

---

## 🥈 Opción 2 — Por WhatsApp (lo más simple)

Mandás el archivo **`pinistudio-para-compartir.zip`** (ya está en el proyecto, 26 KB).

Cada amigo:
1. Descarga el ZIP y lo descomprime.
2. Abre `pinistudio.html` con doble clic.
3. Listo: funciona en el navegador, sin instalar nada.

**Ojo:** así el push (notificaciones con la app cerrada) **no** funciona, porque
`file://` no es un contexto seguro. Para los recordatorios usen **📅 Exportar al
calendario** y listo.

---

## 🥉 Opción 3 — Por la Wi-Fi de tu casa (para probar ahora mismo)

```powershell
powershell -ExecutionPolicy Bypass -File .\servidor-lan.ps1
```

Te muestra algo como:
```
  PiniStudio en la red local
  http://192.168.1.16:8090
```

Pasale ese link a los amigos **que estén conectados a tu misma Wi-Fi**.
- Funciona al instante, sin cuentas ni registros.
- La compu tiene que estar encendida y con el server corriendo.
- El push tampoco anda por acá (es `http` en una IP privada).

---

## 🎁 Bonus: que se descarguen su propia copia

Dentro de la app, el botón **⬇️ (Descargar copia de la app)** baja un `pinistudio.html`
con los datos de esa persona ya cargados. Así cada amigo se queda con su versión.

Y el botón **💾 (Descargar mis datos)** baja un `.json` con todo, por si quiere
cargar sus datos en otro navegador.

---

## 📋 Checklist antes de compartir

- [ ] Probá la app desde el celu (adaptá el layout si hace falta).
- [ ] Revisá que no queden datos tuyos de prueba (⚙️ → **Borrar todo** si querés
      empezar de cero vos también).
- [ ] Si la subís a Netlify: probá el link en el celu.
- [ ] Si querés que les avise de los exámenes con la app cerrada: que cada uno
      use **📅 Exportar al calendario** (o montá el `worker-push.js`).

---

## 🔁 Actualizar la app después

Si tocás el código y querés volver a subirlo:

```powershell
# 1. Regenerar la versión de un solo archivo
powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1

# 2. Actualizar la carpeta que se sube a Netlify
Copy-Item index.html,styles.css,app.js,sw.js publicar\ -Force

# 3. Volver a arrastrar la carpeta publicar/ a Netlify Drop
```

¡Y listo! Tu gente recibe la versión nueva la próxima vez que abra el link.
