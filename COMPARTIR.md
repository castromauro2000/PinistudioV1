# 📤 Cómo compartir PiniStudio (paso a paso)

La mejor forma es **publicarla en internet** y mandar el link por WhatsApp.
Es gratis y tarda 5 minutos.

---

## ✅ Opción A — Link público con Netlify (la recomendada)

### Paso 1 — Entrá a Netlify
Abrí esta dirección en el navegador:

**<https://app.netlify.com/drop>**

Te va a pedir crear una cuenta. Podés entrar con:
- **Google** (más rápido, un clic), o
- **GitHub**, o
- **correo + contraseña**

*(Es gratis, no pide tarjeta.)*

### Paso 2 — Subí la carpeta
En la página de Netlify hay un recuadro grande que dice **"Drag and drop your site output folder here"**.

1. Abrí la carpeta del proyecto en el explorador de archivos:
   ```
   C:\Users\Lucas\Documents\Proyecto predeterminado\publicar
   ```
2. **Arrastrá esa carpeta entera** al recuadro de Netlify.

> ⚠️ Importante: arrastrá la **carpeta `publicar`**, no la carpeta del proyecto
> completa ni el archivo `pinistudio.html`.

### Paso 3 — Copiá el link
Netlify sube los archivos y te muestra algo como:

```
https://alejandro-pinistudio.netlify.app
```

Copiá ese link. **¡Listo!** Ya lo podés mandar por WhatsApp.

### Paso 4 — Comprobá que anda
Abrí el link vos mismo. Tiene que verse la app, con:
- el ícono 📚,
- el calendario,
- y abajo a la derecha el botón **⬇️** para que cada amigo baje su copia.

---

## 📲 Que se instalen en el celu (Android)

Que cada amigo abra el link y toque el botón **📲** que sale arriba a la derecha
de la app. En iPhone: botón Compartir (⬆️) → "Añadir a pantalla de inicio".

---

## ✅ Opción B — Por WhatsApp (sin cuentas, para hoy mismo)

En el proyecto tenés el archivo:

```
pinistudio-para-compartir.zip   (26 KB)
```

**Vos**: lo mandás por WhatsApp.
**Ellos**: lo descargan, lo descomprimen y abren `pinistudio.html` con doble clic.

Funciona perfecto, pero **no se puede instalar en el celu** (por seguridad,
los navegadores no instalan apps desde archivos locales). Para las notificaciones
de exámenes, en este caso usen **📅 Exportar al calendario**.

---

## ✅ Opción C — Por tu Wi-Fi (para probar ahora, sin internet)

El servidor ya está corriendo. Deciles a tus amigos que se conecten a **tu misma
Wi-Fi** y entren a:

```
http://192.168.1.16:8090
```

Requisito: tu compu tiene que estar encendida con el server corriendo
(la terminal con `servidor-lan.ps1` abierta).

---

## 🆘 Si algo falla

| Problema | Solución |
|---|---|
| Netlify dice "no files" | Estás arrastrando el archivo, no la carpeta `publicar` |
| El link da error 404 | Subiste la carpeta equivocada (falta `index.html` adentro) |
| Los íconos no aparecen | Subiste solo `index.html` en vez de la carpeta completa |
| Querés actualizar la app | Volvé a arrastrar `publicar/` a Netlify Drop (reemplaza) |

### Cómo volver a subir una versión nueva
```powershell
powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
Copy-Item index.html,styles.css,app.js,sw.js,manifest.json publicar\ -Force
Copy-Item icons\*.png publicar\icons\ -Force
```
Y después arrastrás `publicar/` otra vez a Netlify.
