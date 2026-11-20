# Lección 7 — Un bug real: los arrays aplanados de PowerShell

Esta lección no es de la app: es de una **herramienta**. Pero el error que pasó es
de los que te cambian la forma de pensar.

---

## 1. Lo que pasó

Quería renombrar la app de "AlexStudio" a "PiniStudio" en varios archivos de un
tiro. Escribí un script así:

```powershell
$fix = @{
  "app.js"       = @(@('PLAN DE ESTUDIO', 'PINISTUDIO'))
  "README.md"    = @(@('ALEXSTUDIO', 'PINISTUDIO'))
}
foreach ($f in $fix.Keys) {
  $txt = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
  foreach ($par in $fix[$f]) { $txt = $txt.Replace($par[0], $par[1]) }
  ...
}
```

Y el resultado fue que **todas las letras "P" del código se convirtieron en "L"**.

## 2. Por qué

Acá está la trampa de PowerShell: **los arrays anidados se aplanan**.

```powershell
$a = @(@('X', 'Y'))
$a.Count          # 2  (¡no 1!)
$a[0]             # 'X'
$a[1]             # 'Y'
```

Lo que yo quería escribir era "una lista con UN par de dos strings". Pero
`@(@('X','Y'))` es **exactamente lo mismo** que `@('X','Y')`: un array plano de dos
strings. El array interno no existe.

Entonces, en el `foreach`:

```powershell
foreach ($par in $fix[$f]) {
  $txt = $txt.Replace($par[0], $par[1])
}
```

- En la primera vuelta, `$par` = `'PLAN DE ESTUDIO'` → `$par[0]` = **'P'** (la primera
  letra) y `$par[1]` = **'L'** (la segunda letra).
- O sea: `Replace('P', 'L')` sobre TODO el archivo. 💥
- En la segunda vuelta, `$par` = `'PINISTUDIO'` → `Replace('P', 'I')`.

## 3. Por qué fue tan difícil de arreglar

El problema de un reemplazo de caracteres es que **no es invertible**: después de
`P` → `L`, las "L" originales y las "P" convertidas son idénticas. No hay forma
automática de saber cuáles eran cuáles.

Las herramientas que salvan:

### a) Buscar los tokens sospechosos
```powershell
[regex]::Matches($txt, '[A-Za-zÁÉÍÓÚáéíóúÑ_$][A-Za-zÁÉÍÓÚáéíóúÑ_$]*') |
  ForEach-Object { $_.Value } |
  Where-Object { $_ -cmatch 'L' } | Sort-Object -Unique
```
Lista todas las palabras con "L" mayúscula. Las que no son palabras conocidas
son las sospechosas (`Lanel`, `Lausa`, `Leríodo`...).

### b) Revertir con un mapa EXPLÍCITO
```powershell
$mapa = @(
  @{ f = 'Lanel'; t = 'Panel' }
  @{ f = 'Lausa'; t = 'Pausa' }
)
foreach ($par in ($mapa | Sort-Object { -($_.f.Length) })) {
  $txt = $txt.Replace($par.f, $par.t)
}
```

Dos detalles importantes:

1. **Ordenar por longitud descendente**: si tuvieras que reemplazar `Pan` y `Panel`,
   hay que reemplazar `Panel` primero, o `Pan` rompería `Panel`.
2. **Usar una lista de hashtables `@{ f=...; t=... }`** en vez de un hashtable con
   claves: ¡porque las claves del hashtable son case-insensitive! `LINISTUDIO` y
   `LiniStudio` chocan (ambas son "linistudio" en minúsculas) y PowerShell tira
   "claves duplicadas".

### c) Verificar con palabras clave
```powershell
Select-String -Path app.js -Pattern 'Panel|Período|Pintar|Push|Progreso'
```
Si aparecen, la reparación funcionó.

## 4. Reglas que me llevo

1. **En PowerShell, `@(@('a','b'))` NO crea un array de arrays.** Si necesitás
   pares, usá `@{ f='a'; t='b' }` o una lista de objetos.
2. **Nunca uses índices de string (`$par[0]`) esperando obtener "el elemento"**
   si lo que tenés es un string: `$par[0]` es el PRIMER CARÁCTER.
3. **Un reemplazo de caracteres es una operación destructiva.** Antes de aplicarlo
   sobre un archivo que te importa: hacé una copia, o probá sobre un texto de prueba.
4. **Después de un rename masivo, verificá**: buscá los tokens raros y leé un par
   de líneas con los ojos.

## 5. Script de reparación (`reparar.ps1`)

Quedó en el proyecto. Es el mapa explícito de lo que había que deshacer, y sirve
como ejemplo de "reparación con mapa" en vez de "reemplazo a ciegas".

```powershell
# aplicarlo
powershell -ExecutionPolicy Bypass -File .\reparar.ps1

# verificar que no quedó nada roto
Select-String -Path app.js -Pattern 'selLeriodo|btnLermiso|estadoLush'
```

Si la segunda comando no devuelve nada, está todo bien.

---

## 📝 Para practicar

1. Escribí un script de PowerShell que renombre variables en varios `.js` usando
   un mapa, **sin** tocar letras sueltas.
2. Hacé un "buscador de tokens sospechosos": que liste palabras que mezclan
   mayúsculas y minúsculas de forma rara (`Lanel`, `xmlHttpRequest`).
3. Escribí un script que haga un **respaldo** (copia con fecha) antes de cada
   modificación automática de archivos.
