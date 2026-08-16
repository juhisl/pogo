try {
  document.getElementById("copyShiny").addEventListener("click", () => navigator.clipboard.writeText(document.getElementById("shiny").innerText))
  document.getElementById("copyLucky").addEventListener("click", () => navigator.clipboard.writeText(document.getElementById("lucky").innerText))

  const shinyResp = await fetch('https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Missing%20Shiny&range=F1')
  const shiny = await shinyResp.text()
  document.getElementById("shiny").innerHTML = `${shiny.replace(/(^"|"$)/g, '')}&shiny&!traded`

  const luckyResp = await fetch('https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Missing%20Lucky&range=F1')
  const lucky = await luckyResp.text()
  document.getElementById("lucky").innerHTML = `${lucky.replace(/(^"|"$)/g, '')}&!traded`

  const updatedResp = await fetch('https://docs.google.com/spreadsheets/d/1GBORc_fa3vH1Jj0h-a_5tmmuYvYRwmYIAHC-Tcr6VG8/gviz/tq?tqx=out:csv&sheet=Pokedex&range=AR1')
  const updated = await updatedResp.text()
  document.getElementById("updated").innerHTML = `Last updated: ${updated.replace(/(^"|"$)/g, '')}`
} catch (e) {
  document.getElementById("updated").innerHTML = "Error: " + e
}
