import styled from "styled-components"

import colors from "../../utils/colors"

const ButtonChallengeLocked = styled.div<{ title: string }>`

	width: 100%;
	height: 100%;

	border: 0;

	text-align: center;
	font-size: 10px;
	
	background-color: ${(props) => props.color};

	&:focus-visible {
		outline: none;
		background-color: ${colors.focusButton};
	}

`

export default ButtonChallengeLocked