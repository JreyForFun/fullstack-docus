// web scrapping
const API_URL="https://jsonplaceholder.typicode.com/users/1&0"


function transform(rawData){
    return {
        id: rawData.id,
        name: rawData.name,
        email: rawData.email,
        company: rawData.company.name
    }
}

async function fetchExternalUser() {
    // abortcontroller lets us cancel an inprosess fetch request
    const controller = new AbortController()

    const timer = setTimeout(() => {
        controller.abort()
    }, 5000)

    try {
        const res = await fetch(API_URL, {
            method: "GET",
            signal : controller.signal
        })

        if(!res.ok){
            console.error(`upstream api failed with http ${res.error}`)
        }
        const rawUser = await res.json()
        const user = transform(rawUser)
        console.log(user)
    } catch (err) {
        if(err instanceof Error && err.name === "AbortError"){
            console.error('request failed because upstream api took so long')
            return
        }

        console.error("External api failed")
    } finally {
        clearTimeout(timer)
    }
}

fetchExternalUser()