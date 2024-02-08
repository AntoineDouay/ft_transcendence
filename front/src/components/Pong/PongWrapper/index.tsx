import { useRef, useState, useContext, useEffect } from "react"
import styled from "styled-components"
import axios, { AxiosResponse } from "axios"
import AuthContext from "../../../contexts/AuthContext"
import InteractionContext from "../../../contexts/InteractionContext"




import Pong from "./Pong"
import { User } from "../../../utils/types"
import colors from "../../../utils/colors"
import Button from "../../../componentsLibrary/Button"
import Loader from "../../../componentsLibrary/Loader"
import PongPopupError from "./PongPopupError"
// import colors from "../../utils/colors"

const Style = styled.div<{ $backgroundColor: string }>`

    position: relative;

    width: 100%;
    height: 100%;

	display: flex;
	/* align-items: center;
	justify-content: center; */

	flex-direction: column;
	align-items: center;
	justify-content: space-evenly;


    background-color: ${(props) => props.$backgroundColor};
	transition: background-color 1s ease;

`

// const PlayButtonStyle = styled.div`
    
//     position: absolute;
//       top: 20px;
//       left: 50%;
//       transform: translateX(-50%);
//       padding: 10px 20px;
//       font-size: 16px;
//     background-color: black;
//       cursor: pointer;
// `

// const SpectateButtonStyle = styled.div`
	
// 	position: absolute;
//   	top: 75%;
//   	left: 75%;
//   	transform: translateX(-50%);
//   	padding: 2% 4%;
//   	font-size: 16px;
// 	background-color: black;
//   	cursor: pointer;
// `

// const PlayButtonStyle = styled.div`
	
// 	/* position: absolute; */
//   	/* top: 50%;
//   	left: 50%; */
//   	/* transform: translateX(-50%); */
// 	width: 350px;
//   	padding: 2% 4%;
//   	font-size: 16px;
// 	background-color: black;
//   	cursor: pointer;
// `
// const DisconnectTextStyle = styled.div`
// 	position: absolute;
//   	top: 50%;
//   	left: 50%;
//   	transform: translateX(-50%);
//   	padding: 2% 4%;
//   	font-size: 16px;
// 	background-color: black;
//   	cursor: pointer;
// `

function PongWrapper({social}: any) {

	const wrapperRef = useRef<HTMLDivElement | null>(null)

	const { token, url } = useContext(AuthContext)!
	const { userAuthenticate } = useContext(InteractionContext)!


	const [searching, setSearching] = useState<boolean>(false)

	const [gameState, setGameState] = useState<boolean>(false)
	const [spectate, setSpectate] = useState<boolean>(false)
	const [difficultyChoose, setDifficultyChoose] = useState<boolean>(false)
	const [score, setScore] = useState<{left: number, right: number}>({left: 0, right: 0})
	const [backgroundColor, setBackgroundColor] = useState<string>(colors.pongWrapperBackground)
	const [pongPopupError, displayPongPopupError] = useState<{ display: boolean, message?: string }>({ display: false, message: undefined })



	function handlePlayButton(){
		console.log('user socket', userAuthenticate)
		setSearching(true)
		if(difficultyChoose)
			setDifficultyChoose(false)
	}

	function handleChooseDifficulty(dif: number){
		setDifficultyChoose(true)
		userAuthenticate.socket?.emit('searchGame', userAuthenticate.id, dif)
	}

	function handleCancelButton()
	{
		setSearching(false)
		userAuthenticate.socket?.emit('cancelSearching', userAuthenticate.id)
	}

	function handleLaunchGame(){
		setSearching(false)
		setDifficultyChoose(false)
		setGameState(true)
	}

	function handleDisconnect(){
		setGameState(false)
		displayPongPopupError({ display: true, message: "Your enemy has Disconnect" })
		setBackgroundColor(colors.pongWrapperBackground)
	}

	function handleSpectate(){
		setSpectate(true)
		setGameState(true)
	}

	useEffect(() => {
		userAuthenticate.socket?.on("decoInGame", handleDisconnect)
		userAuthenticate.socket?.on("spectate", handleSpectate)
		userAuthenticate.socket?.on("launchGame", handleLaunchGame)
		return () =>{
			userAuthenticate.socket?.off("launchGame")
			userAuthenticate.socket?.off("spectate")
			userAuthenticate.socket?.off("decoInGame")
		}
	})

	const [loaderSize, setLoaderSize] = useState<number>(0)

	useEffect(() => {

		const PongWrapperContainer = wrapperRef.current
		if (PongWrapperContainer)
			setLoaderSize(PongWrapperContainer.getBoundingClientRect().width * 30 / 100)

	}, [window.innerWidth, window.innerHeight, social])

	useEffect(() => {
		if(!gameState)
			setBackgroundColor(colors.pongWrapperBackgroundDraw)
	}, [gameState])

	useEffect(() => {
		if (!gameState)
			setBackgroundColor(colors.pongWrapperBackground)
		else
		{
			if (!spectate)
			{
				if (score.left > score.right)
					setBackgroundColor(colors.pongWrapperBackgroundWin)
				else if (score.left < score.right)
					setBackgroundColor(colors.pongWrapperBackgroundLoose)
				else
					setBackgroundColor(colors.pongWrapperBackgroundDraw)
			}
		}
	}, [score])

	return (
		<Style $backgroundColor={backgroundColor} ref={wrapperRef}>
			{
			pongPopupError.display ? (
				<PongPopupError
					displayPongPopupError={displayPongPopupError}
					message={pongPopupError.message}/>
				)
			:
			(
			<>
			{
				!gameState ?
				<>
					{
						!searching ?
						<Button
							onClick={handlePlayButton}
							type="button" fontSize={"5.5vw"}
							alt="" title=""
							style={{width: "35%"}}>
							Play !
						</Button>
						:
						(
							!difficultyChoose ?
								<>
									<Button onClick={() => handleChooseDifficulty(1)} type="button" fontSize={"5.5vw"} alt="" title=""style={{width: "35%"}}>Ez</Button>
									<Button  onClick={() => handleChooseDifficulty(2)} type="button" fontSize={"5.5vw"} alt="" title=""style={{width: "35%"}}>Medium</Button>
									<Button  onClick={() => handleChooseDifficulty(3)} type="button" fontSize={"5.5vw"} alt="" title=""style={{width: "35%"}}>Hard</Button>
									{/* handleChooseDifficulty */}
								</>
							:
							<>
								<Loader size={loaderSize} />
								<div style={{ height: "8%"}} />
								<Button
									onClick={handleCancelButton}
									type="button" fontSize={"2.25vw"}
									alt="" title=""
									style={{width: "17.5%"}}>
									Cancel
								</Button>
							</>
						)
					}
				</>
				:

				<Pong score={score} setScore={setScore} setGameState={setGameState} setSpectate={setSpectate} spectate={spectate}
						social={social}/>
				}
			</>
			)
		}
		</Style>
		);
}

export default PongWrapper